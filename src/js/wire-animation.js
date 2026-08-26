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

  var W, H, srcX, modX, execX, rejectX, reviewX;
  var SRC = [], MODS = [], EXEC = [], REJECT_BOX = null, REVIEW_BOX = null;

  function layout() {
    var cw = canvas.parentElement.clientWidth - 48;
    var ch = 460;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width  = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    W = canvas.width;
    H = canvas.height;

    srcX    = W * 0.09;
    modX    = W * 0.38;
    reviewX = W * 0.62;
    execX   = W * 0.88;
    rejectX = W * 0.62;

    var pad = H * 0.05;
    var gap = H * 0.025;

    // Sources — left column
    var sh = (H * 0.6 - gap * 2) / 3;
    var srcTop = H * 0.08;
    SRC = [
      { id:'api',  label:'REST APIs',      sub:'real-time', x:srcX, y:srcTop,              w:W*0.13, h:sh, col:C.amber,  colD:C.amberD  },
      { id:'file', label:'Flat files',     sub:'batch',     x:srcX, y:srcTop+sh+gap,       w:W*0.13, h:sh, col:C.amber,  colD:C.amberD  },
      { id:'zday', label:'0-day payments', sub:'same-day',  x:srcX, y:srcTop+sh*2+gap*2,   w:W*0.13, h:sh, col:C.amber,  colD:C.amberD  },
    ];

    // Platform modules — center column
    var mh = (H * 0.72 - gap * 3) / 4;
    var modTop = H * 0.06;
    MODS = [
      { id:'norm', label:'Normalize data',       sub:'unify all source formats',              x:modX, y:modTop,                w:W*0.38, h:mh, col:C.amber,  colD:C.amberD,  _hl:0 },
      { id:'cfg',  label:'Configuration module', sub:'funds · teams · SSIs — data not code', x:modX, y:modTop+mh+gap,         w:W*0.38, h:mh, col:C.purple, colD:C.purpleD, _hl:0 },
      { id:'en',   label:'Enable / disable',     sub:'some pass · some reject',               x:modX, y:modTop+mh*2+gap*2,    w:W*0.38, h:mh, col:C.red,    colD:C.redD,    _hl:0 },
      { id:'stp',  label:'STP core engine',      sub:'validate · match SSI · route',          x:modX, y:modTop+mh*3+gap*3,    w:W*0.38, h:mh, col:C.teal,   colD:C.tealD,   _hl:0 },
    ];

    // Human review — right of STP core, vertically centered with it
    var stpMod = MODS[3];
    var rvW = W * 0.18, rvH = mh * 1.1;
    REVIEW_BOX = {
      label: 'Human review',
      sub:   'approves or rejects',
      x: reviewX, y: stpMod.y - (rvH - stpMod.h)/2,
      w: rvW, h: rvH,
      col: C.orange, colD: C.orangeD, _hl: 0
    };

    // Execution rails — far right
    var eh = (H * 0.65 - gap * 2) / 3;
    var execTop = H * 0.08;
    EXEC = [
      { label:'Kyriba TMS', sub:'treasury mgmt',  x:execX, y:execTop,          w:W*0.13, h:eh, col:C.blue, colD:C.blueD },
      { label:'SWIFT',      sub:'99.9% of wires', x:execX, y:execTop+eh+gap,   w:W*0.13, h:eh, col:C.blue, colD:C.blueD },
      { label:'Bank APIs',  sub:'direct rails',   x:execX, y:execTop+eh*2+gap*2,w:W*0.13, h:eh, col:C.blue, colD:C.blueD },
    ];

    // Reject queue — bottom center-right
    REJECT_BOX = {
      label: 'Reject queue',
      sub:   'requires investigation',
      x: W * 0.50, y: H * 0.85,
      w: W * 0.30, h: H * 0.10,
      col: C.red, colD: C.redD, _hl: 0
    };
  }

  function rgba(hex, a) {
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  function bcy(b) { return b.y + b.h/2; }
  function brx(b) { return b.x + b.w/2; }
  function blx(b) { return b.x - b.w/2; }

  function drawBox(b, hl) {
    hl = hl || 0;
    var r = 7*dpr, x = blx(b), y = b.y;
    ctx.beginPath(); ctx.roundRect(x, y, b.w, b.h, r);
    ctx.fillStyle = rgba(b.col, 0.13 + hl*0.15); ctx.fill();
    ctx.strokeStyle = rgba(b.colD, 0.5 + hl*0.4);
    ctx.lineWidth = dpr*(hl ? 2 : 0.9); ctx.stroke();
    var fs = Math.max(11, Math.floor(12*dpr/2));
    ctx.fillStyle = b.colD;
    ctx.font = '600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h*0.37);
    var ss = Math.max(8, Math.floor(9*dpr/2));
    ctx.fillStyle = C.muted;
    ctx.font = ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y + b.h*0.68);
  }

  function drawReviewBox() {
    var b = REVIEW_BOX, hl = b._hl||0;
    var r = 50; // pill shape
    var x = blx(b), y = b.y;
    ctx.beginPath(); ctx.roundRect(x, y, b.w, b.h, r*dpr);
    ctx.fillStyle = rgba(b.col, 0.13 + hl*0.15); ctx.fill();
    ctx.strokeStyle = rgba(b.colD, 0.5 + hl*0.4);
    ctx.lineWidth = dpr*(hl ? 2 : 1); ctx.setLineDash([4*dpr,3*dpr]); ctx.stroke(); ctx.setLineDash([]);
    // Person icon
    var cx = b.x, cy = b.y + b.h*0.30, cr = b.h*0.13;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2);
    ctx.fillStyle = rgba(b.colD, 0.7); ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + cr*1.8, cr*1.5, Math.PI, 0);
    ctx.fillStyle = rgba(b.colD, 0.4); ctx.fill();
    var fs = Math.max(9, Math.floor(10*dpr/2));
    ctx.fillStyle = b.colD;
    ctx.font = '600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h*0.72);
    var ss = Math.max(7, Math.floor(8*dpr/2));
    ctx.fillStyle = C.muted;
    ctx.font = ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y + b.h*0.88);
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

  function drawArrow(x1,y1,x2,y2,col,dashed) {
    ctx.beginPath();
    if(dashed) ctx.setLineDash([4*dpr,3*dpr]); else ctx.setLineDash([]);
    ctx.strokeStyle=rgba(col,0.25); ctx.lineWidth=dpr*0.7;
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawConnectors() {
    ctx.setLineDash([4*dpr,4*dpr]); ctx.lineWidth=dpr*0.7; ctx.strokeStyle=rgba(C.gray,0.2);
    // Sources → Normalize
    SRC.forEach(function(s){
      var m=MODS[0], sx=brx(s), sy=bcy(s), tx=blx(m), ty=bcy(m);
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.bezierCurveTo(sx+W*0.06,sy,tx-W*0.06,ty,tx,ty); ctx.stroke();
    });
    // Module chain
    for(var i=0;i<MODS.length-1;i++){
      var a=MODS[i],b=MODS[i+1];
      ctx.beginPath(); ctx.moveTo(a.x,a.y+a.h); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    // Enable/Disable → Reject queue (reject path)
    var en=MODS[2], rq=REJECT_BOX;
    ctx.beginPath(); ctx.moveTo(brx(en), bcy(en));
    ctx.bezierCurveTo(brx(en)+W*0.04,bcy(en),rq.x,rq.y-H*0.04,rq.x,rq.y);
    ctx.strokeStyle=rgba(C.red,0.25); ctx.stroke();
    // STP → Human review
    var stp=MODS[3], rv=REVIEW_BOX;
    ctx.beginPath(); ctx.moveTo(brx(stp),bcy(stp)); ctx.lineTo(blx(rv),bcy(rv));
    ctx.strokeStyle=rgba(C.orange,0.3); ctx.stroke();
    // Human review → Exec
    EXEC.forEach(function(e){
      var sx=brx(rv),sy=bcy(rv),tx=blx(e),ty=bcy(e);
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.bezierCurveTo(sx+W*0.04,sy,tx-W*0.04,ty,tx,ty);
      ctx.strokeStyle=rgba(C.blue,0.2); ctx.stroke();
    });
    // Human review → Reject queue
    ctx.beginPath(); ctx.moveTo(rv.x, rv.y+rv.h);
    ctx.bezierCurveTo(rv.x,rv.y+rv.h+H*0.05,rq.x,rq.y-H*0.02,rq.x,rq.y);
    ctx.strokeStyle=rgba(C.red,0.2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Labels on connectors
  function drawLabels() {
    var fs=Math.max(8,Math.floor(9*dpr/2));
    ctx.font=fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textBaseline='middle';
    // reject from enable/disable
    var en=MODS[2],rq=REJECT_BOX;
    ctx.fillStyle=rgba(C.redD,0.7); ctx.textAlign='right';
    ctx.fillText('rejected', brx(en)+W*0.06, bcy(en)+H*0.06);
    // approve from review
    var rv=REVIEW_BOX;
    ctx.fillStyle=rgba(C.tealD,0.7); ctx.textAlign='left';
    ctx.fillText('approved', brx(rv)+4*dpr, bcy(rv)-H*0.04);
    // reject from review
    ctx.fillStyle=rgba(C.redD,0.7); ctx.textAlign='center';
    ctx.fillText('rejected', rv.x, rv.y+rv.h+H*0.04);
  }

  // PHASES:
  // 0 = src → normalize entry
  // 1 = inside normalize
  // 2 = inside cfg
  // 3 = inside enable/disable  → may REJECT here
  // 4 = inside stp
  // 5 = stp → human review
  // 6 = inside human review    → may REJECT here
  // 7 = review → exec rail
  // 8 = REJECTED → reject queue
  // 9 = done

  function Particle(si) {
    var s=SRC[si];
    this.phase=0; this.t=0;
    this.speed=0.013+Math.random()*0.007;
    this.ei=Math.floor(Math.random()*EXEC.length);
    this.rejected=false;
    this.rejectAt=0;
    this.col=s.col; this.size=dpr*(2.2+Math.random()*0.8);
    this.sx=s.x+s.w/2; this.sy=bcy(s);
    this.tx=0; this.ty=0;
    // decide fate upfront: ~15% rejected at enable/disable, ~10% at review
    var r=Math.random();
    if(r<0.15)      { this.rejectAt=3; }
    else if(r<0.25) { this.rejectAt=6; }
    else            { this.rejectAt=99; }
    this.setTarget();
  }

  Particle.prototype.setTarget = function() {
    var m0=MODS[0];
    if(this.phase===0){ this.tx=blx(m0); this.ty=bcy(m0); }
    else if(this.phase>=1&&this.phase<=4){ var m=MODS[this.phase-1]; this.tx=m.x; this.ty=bcy(m); }
    else if(this.phase===5){ this.tx=blx(REVIEW_BOX); this.ty=bcy(REVIEW_BOX); }
    else if(this.phase===6){ this.tx=REVIEW_BOX.x; this.ty=bcy(REVIEW_BOX); }
    else if(this.phase===7){ var e=EXEC[this.ei]; this.tx=blx(e); this.ty=bcy(e); }
    else if(this.phase===8){ this.tx=REJECT_BOX.x; this.ty=REJECT_BOX.y; }
  };

  Particle.prototype.update = function() {
    this.t+=this.speed;
    if(this.t>=1){
      this.t=0; this.sx=this.tx; this.sy=this.ty; this.phase++;
      // Check rejection at enable/disable (after phase 3 completes → entering phase 4)
      if(this.phase===4 && this.rejectAt===3){
        this.rejected=true; this.col=C.red; this.phase=8;
        MODS[2]._hl=1;
        rejectCount++;
        var rel=document.getElementById('rejectCount'); if(rel) rel.textContent=rejectCount;
      }
      // Check rejection at human review (after phase 6 → entering phase 7)
      else if(this.phase===7 && this.rejectAt===6){
        this.rejected=true; this.col=C.red; this.phase=8;
        REVIEW_BOX._hl=1;
        rejectCount++;
        var rel2=document.getElementById('rejectCount'); if(rel2) rel2.textContent=rejectCount;
      }
      else if(this.phase===9){
        wireCount++;
        var wl=document.getElementById('wireCount'); if(wl) wl.textContent=wireCount;
        return true;
      }
      else if(this.phase===9||this.phase>9){ return true; }
      // Highlight modules
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
    var mx=(this.sx+this.tx)/2, my=(this.sy+this.ty)/2-H*0.02;
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
    drawConnectors(); drawLabels(); drawPlatform();
    MODS.forEach(function(m){if(m._hl)m._hl=Math.max(0,m._hl-0.025);});
    if(REVIEW_BOX._hl) REVIEW_BOX._hl=Math.max(0,REVIEW_BOX._hl-0.025);
    if(REJECT_BOX._hl) REJECT_BOX._hl=Math.max(0,REJECT_BOX._hl-0.025);
    SRC.forEach(function(b){drawBox(b,0);});
    MODS.forEach(function(b){drawBox(b,b._hl);});
    drawReviewBox();
    drawBox(REJECT_BOX, REJECT_BOX._hl);
    EXEC.forEach(function(b){drawBox(b,0);});
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    requestAnimationFrame(loop);
  }

  // Wire up buttons
  var btnMap={btnApi:'api',btnFile:'file',btnZday:'zday'};
  Object.keys(btnMap).forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.addEventListener('click',function(){fireSource(btnMap[id]);});
  });
  var btnAll=document.getElementById('btnAll');
  var btnAuto=document.getElementById('autoBtn');
  if(btnAll) btnAll.addEventListener('click',fireAll);
  if(btnAuto) btnAuto.addEventListener('click',toggleAuto);
  window.addEventListener('resize',function(){layout();});

  layout(); loop(); scheduleAuto();
});
