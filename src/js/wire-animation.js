document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('archCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [];
  var wireCount = 0;
  var rejectCount = 0;
  var autoMode = true;
  var autoTimer = null;

  var C = {
    amber:   '#EF9F27', amberD:  '#A8763B',
    teal:    '#1D9E75', tealD:   '#0F6E56',
    blue:    '#378ADD', blueD:   '#185FA5',
    purple:  '#7F77DD', purpleD: '#534AB7',
    red:     '#E05252', redD:    '#B03030',
    orange:  '#E07820', orangeD: '#A85010',
    gray:    '#888780', muted:   '#6B665E'
  };

  var W, H, srcX, modX, rightX;
  var SRC = [], MODS = [], EXEC = [];
  var REJECT_BOX = null, REVIEW_BOX = null;

  function layout() {
    var cw = canvas.parentElement.clientWidth - 48;
    var ch = 500;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width  = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    W = canvas.width;
    H = canvas.height;

    srcX   = W * 0.09;
    modX   = W * 0.38;
    rightX = W * 0.82;

    var pad = H * 0.05;
    var gap = H * 0.025;

    // Sources — left
    var sh = (H * 0.58 - gap * 2) / 3;
    var srcTop = H * 0.20;
    SRC = [
      { id:'api',  label:'REST APIs',      sub:'real-time', x:srcX, y:srcTop,             w:W*0.13, h:sh, col:C.amber, colD:C.amberD },
      { id:'file', label:'Flat files',     sub:'batch',     x:srcX, y:srcTop+sh+gap,      w:W*0.13, h:sh, col:C.amber, colD:C.amberD },
      { id:'zday', label:'0-day payments', sub:'same-day',  x:srcX, y:srcTop+sh*2+gap*2,  w:W*0.13, h:sh, col:C.amber, colD:C.amberD },
    ];

    // Platform modules — center
    var mh = (H * 0.80 - gap * 3) / 4;
    var modTop = H * 0.06;
    MODS = [
      { id:'norm', label:'Normalize data',       sub:'unify all source formats',              x:modX, y:modTop,              w:W*0.40, h:mh, col:C.amber,  colD:C.amberD,  _hl:0 },
      { id:'cfg',  label:'Configuration module', sub:'funds · teams · SSIs — data not code', x:modX, y:modTop+mh+gap,       w:W*0.40, h:mh, col:C.purple, colD:C.purpleD, _hl:0 },
      { id:'en',   label:'Enable / disable',     sub:'some pass · some reject',               x:modX, y:modTop+mh*2+gap*2,  w:W*0.40, h:mh, col:C.red,    colD:C.redD,    _hl:0 },
      { id:'stp',  label:'STP core engine',      sub:'validate · match SSI · route',          x:modX, y:modTop+mh*3+gap*3,  w:W*0.40, h:mh, col:C.teal,   colD:C.tealD,   _hl:0 },
    ];

    // Right column: Reject Queue on TOP, Human Review below it
    var rqH = H * 0.14;
    var rvH = H * 0.18;
    var rightGap = H * 0.06;
    var rightColTop = H * 0.06;

    REJECT_BOX = {
      label: 'Reject queue',
      sub:   'requires investigation',
      x: rightX, y: rightColTop,
      w: W * 0.22, h: rqH,
      col: C.red, colD: C.redD, _hl: 0
    };

    REVIEW_BOX = {
      label: 'Human review',
      sub:   'approves or rejects',
      x: rightX, y: rightColTop + rqH + rightGap,
      w: W * 0.22, h: rvH,
      col: C.orange, colD: C.orangeD, _hl: 0
    };

    // Execution rails — below review box
    var execTop = REVIEW_BOX.y + REVIEW_BOX.h + rightGap;
    var execAvail = H - execTop - H*0.03;
    var eh = (execAvail - gap * 2) / 3;
    EXEC = [
      { label:'Kyriba TMS', sub:'treasury mgmt',  x:rightX, y:execTop,            w:W*0.22, h:eh, col:C.blue, colD:C.blueD },
      { label:'SWIFT',      sub:'99.9% of wires', x:rightX, y:execTop+eh+gap,     w:W*0.22, h:eh, col:C.blue, colD:C.blueD },
      { label:'Bank APIs',  sub:'direct rails',   x:rightX, y:execTop+eh*2+gap*2, w:W*0.22, h:eh, col:C.blue, colD:C.blueD },
    ];
  }

  function rgba(hex, a) {
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  function bcy(b){ return b.y + b.h/2; }
  function brx(b){ return b.x + b.w/2; }
  function blx(b){ return b.x - b.w/2; }
  function btx(b){ return b.y; }
  function bbx(b){ return b.y + b.h; }

  function drawBox(b, hl) {
    hl = hl || 0;
    var r=7*dpr, x=blx(b), y=b.y;
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=rgba(b.col,0.13+hl*0.15); ctx.fill();
    ctx.strokeStyle=rgba(b.colD,0.5+hl*0.4);
    ctx.lineWidth=dpr*(hl?2:0.9); ctx.stroke();
    var fs=Math.max(10,Math.floor(12*dpr/2));
    ctx.fillStyle=b.colD;
    ctx.font='600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(b.label, b.x, b.y+b.h*0.37);
    var ss=Math.max(8,Math.floor(9*dpr/2));
    ctx.fillStyle=C.muted;
    ctx.font=ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y+b.h*0.70);
  }

  function drawReviewBox() {
    var b=REVIEW_BOX, hl=b._hl||0;
    var r=40*dpr, x=blx(b), y=b.y;
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=rgba(b.col,0.13+hl*0.15); ctx.fill();
    ctx.strokeStyle=rgba(b.colD,0.5+hl*0.4);
    ctx.lineWidth=dpr*(hl?2:1);
    ctx.setLineDash([4*dpr,3*dpr]); ctx.stroke(); ctx.setLineDash([]);
    // Person icon
    var cx=b.x, cy=b.y+b.h*0.28, cr=b.h*0.14;
    ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2);
    ctx.fillStyle=rgba(b.colD,0.7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy+cr*1.9,cr*1.6,Math.PI,0);
    ctx.fillStyle=rgba(b.colD,0.35); ctx.fill();
    var fs=Math.max(9,Math.floor(10*dpr/2));
    ctx.fillStyle=b.colD;
    ctx.font='600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(b.label, b.x, b.y+b.h*0.72);
    var ss=Math.max(7,Math.floor(8*dpr/2));
    ctx.fillStyle=C.muted;
    ctx.font=ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y+b.h*0.88);
  }

  function drawPlatform() {
    var p=10*dpr, m=MODS[0], ml=MODS[MODS.length-1];
    var x=blx(m)-p, y=m.y-p, w=m.w+p*2, h=ml.y+ml.h-m.y+p*2;
    ctx.beginPath(); ctx.roundRect(x,y,w,h,12*dpr);
    ctx.fillStyle=rgba(C.teal,0.03); ctx.fill();
    ctx.strokeStyle=rgba(C.tealD,0.18); ctx.lineWidth=dpr;
    ctx.setLineDash([5*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    var ts=Math.max(9,Math.floor(9*dpr/2));
    ctx.fillStyle=rgba(C.tealD,0.45);
    ctx.font='500 '+ts+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('Payment automation platform', m.x, y+4*dpr);
  }

  function drawConnectors() {
    ctx.setLineDash([4*dpr,4*dpr]);
    ctx.lineWidth=dpr*0.7;

    // Sources → Normalize
    ctx.strokeStyle=rgba(C.gray,0.2);
    SRC.forEach(function(s){
      var m=MODS[0], sx=brx(s), sy=bcy(s), tx=blx(m), ty=bcy(m);
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.bezierCurveTo(sx+W*0.06,sy,tx-W*0.06,ty,tx,ty); ctx.stroke();
    });

    // Module chain (norm→cfg→en→stp)
    ctx.strokeStyle=rgba(C.gray,0.2);
    for(var i=0;i<MODS.length-1;i++){
      var a=MODS[i],b=MODS[i+1];
      ctx.beginPath(); ctx.moveTo(a.x,a.y+a.h); ctx.lineTo(b.x,b.y); ctx.stroke();
    }

    // Enable/Disable → Reject Queue (straight right then up)
    var en=MODS[2], rq=REJECT_BOX;
    ctx.strokeStyle=rgba(C.redD,0.3);
    ctx.beginPath();
    ctx.moveTo(brx(en), bcy(en));
    ctx.bezierCurveTo(brx(en)+W*0.08, bcy(en), blx(rq), bcy(rq), blx(rq), bcy(rq));
    ctx.stroke();

    // STP → Human Review
    var stp=MODS[3], rv=REVIEW_BOX;
    ctx.strokeStyle=rgba(C.orangeD,0.3);
    ctx.beginPath();
    ctx.moveTo(brx(stp), bcy(stp));
    ctx.bezierCurveTo(brx(stp)+W*0.06, bcy(stp), blx(rv), bcy(rv), blx(rv), bcy(rv));
    ctx.stroke();

    // Human Review → Reject Queue (straight up)
    ctx.strokeStyle=rgba(C.redD,0.25);
    ctx.beginPath();
    ctx.moveTo(rv.x, btx(rv));
    ctx.lineTo(rq.x, bbx(rq));
    ctx.stroke();

    // Human Review → Exec (down)
    ctx.strokeStyle=rgba(C.blueD,0.2);
    EXEC.forEach(function(e){
      ctx.beginPath();
      ctx.moveTo(rv.x, bbx(rv));
      ctx.bezierCurveTo(rv.x, bbx(rv)+H*0.04, e.x, btx(e)-H*0.04, e.x, btx(e));
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // Labels
    var fs=Math.max(8,Math.floor(9*dpr/2));
    ctx.font='500 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textBaseline='middle';

    // "rejected" label on en→rq path
    ctx.fillStyle=rgba(C.redD,0.8); ctx.textAlign='center';
    ctx.fillText('rejected', brx(en)+W*0.04, bcy(en)-H*0.025);

    // "approved" label on review→exec path
    ctx.fillStyle=rgba(C.tealD,0.8); ctx.textAlign='center';
    ctx.fillText('approved', rv.x+W*0.01, bbx(rv)+H*0.028);

    // "rejected" label on review→rq path
    ctx.fillStyle=rgba(C.redD,0.8); ctx.textAlign='right';
    ctx.fillText('rejected', blx(rv)-W*0.005, bcy(rv)-rv.h*0.35);
  }

  // PHASES:
  // 0 = src → normalize
  // 1-4 = through modules (norm, cfg, en, stp)
  // 5 = stp → human review
  // 6 = in human review
  // 7 = review → exec (approved)
  // 8 = REJECTED → reject queue
  // 9 = done/arrived

  function Particle(si) {
    var s=SRC[si];
    this.phase=0; this.t=0;
    this.speed=0.013+Math.random()*0.007;
    this.ei=Math.floor(Math.random()*EXEC.length);
    this.col=s.col; this.size=dpr*(2.2+Math.random()*0.8);
    this.sx=s.x+s.w/2; this.sy=bcy(s);
    this.tx=0; this.ty=0;
    var r=Math.random();
    this.rejectAt = r<0.15 ? 3 : r<0.25 ? 6 : 99;
    this.setTarget();
  }

  Particle.prototype.setTarget = function() {
    var m0=MODS[0];
    if(this.phase===0)      { this.tx=blx(m0);          this.ty=bcy(m0); }
    else if(this.phase>=1&&this.phase<=4){ var m=MODS[this.phase-1]; this.tx=m.x; this.ty=bcy(m); }
    else if(this.phase===5) { this.tx=blx(REVIEW_BOX);  this.ty=bcy(REVIEW_BOX); }
    else if(this.phase===6) { this.tx=REVIEW_BOX.x;     this.ty=bcy(REVIEW_BOX); }
    else if(this.phase===7) { var e=EXEC[this.ei]; this.tx=e.x; this.ty=btx(e); }
    else if(this.phase===8) { this.tx=REJECT_BOX.x;     this.ty=bcy(REJECT_BOX); }
  };

  Particle.prototype.update = function() {
    this.t+=this.speed;
    if(this.t>=1){
      this.t=0; this.sx=this.tx; this.sy=this.ty; this.phase++;

      // Reject at enable/disable — go straight to reject queue
      if(this.phase===4 && this.rejectAt===3){
        this.col=C.red; this.phase=8;
        MODS[2]._hl=1;
        rejectCount++;
        var r1=document.getElementById('rejectCount'); if(r1) r1.textContent=rejectCount;
      }
      // Reject at human review — go to reject queue
      else if(this.phase===7 && this.rejectAt===6){
        this.col=C.red; this.phase=8;
        REVIEW_BOX._hl=1;
        rejectCount++;
        var r2=document.getElementById('rejectCount'); if(r2) r2.textContent=rejectCount;
      }
      // Done — arrived at exec or reject queue
      else if(this.phase===9){
        wireCount++;
        var wl=document.getElementById('wireCount'); if(wl) wl.textContent=wireCount;
        return true;
      }
      else if(this.phase>9){ return true; }

      // Highlight nodes
      if(this.phase>=1&&this.phase<=4) MODS[this.phase-1]._hl=1;
      if(this.phase===6) REVIEW_BOX._hl=1;
      if(this.phase===8) REJECT_BOX._hl=1;
      this.setTarget();
    }
    return false;
  };

  Particle.prototype.draw = function() {
    var ease=function(t){return t<0.5?2*t*t:-1+(4-2*t)*t;};
    var et=ease(this.t);
    var mx=(this.sx+this.tx)/2, my=(this.sy+this.ty)/2;
    var bx=(1-et)*(1-et)*this.sx+2*(1-et)*et*mx+et*et*this.tx;
    var by=(1-et)*(1-et)*this.sy+2*(1-et)*et*my+et*et*this.ty;
    for(var i=3;i>=0;i--){
      var tt=Math.max(0,this.t-i*0.05), e2=ease(tt);
      var bx2=(1-e2)*(1-e2)*this.sx+2*(1-e2)*e2*mx+e2*e2*this.tx;
      var by2=(1-e2)*(1-e2)*this.sy+2*(1-e2)*e2*my+e2*e2*this.ty;
      ctx.beginPath(); ctx.arc(bx2,by2,this.size*(0.25+i*0.15),0,Math.PI*2);
      ctx.fillStyle=rgba(this.col,0.1*(4-i)); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(bx,by,this.size,0,Math.PI*2);
    ctx.fillStyle=this.col; ctx.fill();
    ctx.beginPath(); ctx.arc(bx,by,this.size*2.2,0,Math.PI*2);
    ctx.fillStyle=rgba(this.col,0.18); ctx.fill();
  };

  function fireSource(id){
    var idx=SRC.findIndex(function(s){return s.id===id;});
    if(idx>=0) for(var i=0;i<3;i++)(function(ii){setTimeout(function(){particles.push(new Particle(idx));},ii*220);})(i);
  }
  function fireAll(){ ['api','file','zday'].forEach(fireSource); }
  function scheduleAuto(){
    if(!autoMode) return;
    fireSource(['api','file','zday','api','file'][Math.floor(Math.random()*5)]);
    autoTimer=setTimeout(scheduleAuto,800+Math.random()*700);
  }
  function toggleAuto(){
    autoMode=!autoMode;
    var btn=document.getElementById('autoBtn');
    if(btn){ btn.textContent='Auto: '+(autoMode?'ON':'OFF'); if(autoMode)btn.classList.add('active');else btn.classList.remove('active'); }
    if(autoMode) scheduleAuto(); else clearTimeout(autoTimer);
  }

  function loop(){
    ctx.clearRect(0,0,W,H);
    drawConnectors();
    drawPlatform();
    MODS.forEach(function(m){if(m._hl)m._hl=Math.max(0,m._hl-0.025);});
    if(REVIEW_BOX._hl) REVIEW_BOX._hl=Math.max(0,REVIEW_BOX._hl-0.025);
    if(REJECT_BOX._hl) REJECT_BOX._hl=Math.max(0,REJECT_BOX._hl-0.025);
    SRC.forEach(function(b){drawBox(b,0);});
    MODS.forEach(function(b){drawBox(b,b._hl);});
    drawBox(REJECT_BOX, REJECT_BOX._hl);
    drawReviewBox();
    EXEC.forEach(function(b){drawBox(b,0);});
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    requestAnimationFrame(loop);
  }

  // Buttons
  var btnMap={btnApi:'api',btnFile:'file',btnZday:'zday'};
  Object.keys(btnMap).forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.addEventListener('click',function(){fireSource(btnMap[id]);});
  });
  var btnAll=document.getElementById('btnAll');
  var btnAuto=document.getElementById('autoBtn');
  if(btnAll)  btnAll.addEventListener('click',fireAll);
  if(btnAuto) btnAuto.addEventListener('click',toggleAuto);
  window.addEventListener('resize',function(){layout();});

  layout(); loop(); scheduleAuto();
});
