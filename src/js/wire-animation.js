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
    amber:'#EF9F27',  amberD:'#A8763B',
    teal:'#1D9E75',   tealD:'#0F6E56',
    blue:'#378ADD',   blueD:'#185FA5',
    purple:'#7F77DD', purpleD:'#534AB7',
    red:'#E05252',    redD:'#B03030',
    orange:'#E07820', orangeD:'#A85010',
    gray:'#888780',   muted:'#6B665E'
  };

  var W, H;
  var SRC=[], MODS=[];
  var REJECT_BOX=null, REVIEW_BOX=null, EXEC_BOX=null;

  function rgba(hex,a){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  function bcy(b){return b.y+b.h/2;}
  function brx(b){return b.x+b.w/2;}
  function blx(b){return b.x-b.w/2;}
  function btop(b){return b.y;}
  function bbot(b){return b.y+b.h;}

  function layout(){
    // Use full parent width
    var cw = canvas.parentElement.clientWidth - 8;
    var ch = 480;
    canvas.style.width  = cw+'px';
    canvas.style.height = ch+'px';
    canvas.width  = Math.floor(cw*dpr);
    canvas.height = Math.floor(ch*dpr);
    W = canvas.width;
    H = canvas.height;

    // Column x-centers
    var srcX  = W*0.07;   // sources
    var modX  = W*0.28;   // platform modules (center of module)
    var midX  = W*0.65;   // reject queue + human review
    var execX = W*0.88;   // execution

    var gap   = H*0.022;
    var padT  = H*0.06;   // top padding

    // ── Sources (3 boxes, vertically centered across platform height)
    var sh = (H*0.52 - gap*2) / 3;
    var srcTop = H*0.24;
    SRC = [
      {id:'api', label:'REST APIs',  sub:'real-time', x:srcX, y:srcTop,             w:W*0.10, h:sh, col:C.amber, colD:C.amberD},
      {id:'file',label:'Flat files', sub:'batch',     x:srcX, y:srcTop+sh+gap,      w:W*0.10, h:sh, col:C.amber, colD:C.amberD},
      {id:'zday',label:'0-day',      sub:'same-day',  x:srcX, y:srcTop+sh*2+gap*2,  w:W*0.10, h:sh, col:C.amber, colD:C.amberD},
    ];

    // ── Platform modules — 4 equal rows across full canvas height
    var mw  = W*0.32;
    var mh  = (H - padT*2 - gap*3) / 4;
    var modTop = padT;
    MODS = [
      {id:'norm',label:'Normalize data',       sub:'unify all source formats',              x:modX, y:modTop,              w:mw, h:mh, col:C.amber,  colD:C.amberD,  _hl:0},
      {id:'cfg', label:'Configuration module', sub:'funds · teams · SSIs — data not code', x:modX, y:modTop+mh+gap,       w:mw, h:mh, col:C.purple, colD:C.purpleD, _hl:0},
      {id:'en',  label:'Enable / disable',     sub:'some pass · some reject',               x:modX, y:modTop+mh*2+gap*2,  w:mw, h:mh, col:C.red,    colD:C.redD,    _hl:0},
      {id:'stp', label:'STP core engine',      sub:'validate · match SSI · route',          x:modX, y:modTop+mh*3+gap*3,  w:mw, h:mh, col:C.teal,   colD:C.tealD,   _hl:0},
    ];

    // ── Right column: vertically divide the FULL platform height into 3
    var platTop = modTop;
    var platBot = modTop + mh*4 + gap*3;
    var platH   = platBot - platTop;

    var rqH  = platH * 0.25;
    var rvH  = platH * 0.35;
    var exH  = platH * 0.35; // execution gets remaining 35% — but exec spans full height on far right
    var rcGap = (platH - rqH - rvH) / 2; // remaining space split as gaps... actually let's just compute

    // Reject queue: top quarter of platform
    REJECT_BOX = {
      label:'Reject queue', sub:'requires investigation',
      x:midX, y:platTop,
      w:W*0.22, h:rqH,
      col:C.red, colD:C.redD, _hl:0
    };

    // Human review: middle section
    var rvTop = platTop + rqH + (platH - rqH - rvH) / 2;
    REVIEW_BOX = {
      label:'Human review', sub:'approves or rejects',
      x:midX, y:rvTop,
      w:W*0.22, h:rvH,
      col:C.orange, colD:C.orangeD, _hl:0
    };

    // Execution: full platform height, far right
    EXEC_BOX = {
      label:'Execution',
      lines:['Kyriba TMS','SWIFT','Bank APIs'],
      x:execX, y:platTop,
      w:W*0.16, h:platH,
      col:C.blue, colD:C.blueD, _hl:0
    };
  }

  function drawBox(b, hl){
    hl = hl||0;
    var r=8*dpr, x=blx(b), y=b.y;
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle = rgba(b.col, 0.12+hl*0.14); ctx.fill();
    ctx.strokeStyle = rgba(b.colD, 0.45+hl*0.4);
    ctx.lineWidth = dpr*(hl?2:0.9); ctx.stroke();
    var fs = Math.max(11, Math.floor(13*dpr/2));
    ctx.fillStyle = b.colD;
    ctx.font = '600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y+b.h*0.37);
    var ss = Math.max(8, Math.floor(10*dpr/2));
    ctx.fillStyle = C.muted;
    ctx.font = ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y+b.h*0.68);
  }

  function drawExecBox(){
    var b=EXEC_BOX, hl=b._hl||0;
    var r=8*dpr, x=blx(b), y=b.y;
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle = rgba(b.col, 0.10+hl*0.12); ctx.fill();
    ctx.strokeStyle = rgba(b.colD, 0.45+hl*0.4);
    ctx.lineWidth = dpr*(hl?2:0.9); ctx.stroke();

    // Title
    var fs = Math.max(11, Math.floor(13*dpr/2));
    ctx.fillStyle = b.colD;
    ctx.font = '700 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h*0.12);

    // Divider
    ctx.beginPath();
    ctx.moveTo(blx(b)+10*dpr, b.y+b.h*0.22);
    ctx.lineTo(brx(b)-10*dpr, b.y+b.h*0.22);
    ctx.strokeStyle = rgba(b.colD, 0.18); ctx.lineWidth = dpr*0.7; ctx.stroke();

    // Sub-items — evenly spaced in lower 78%
    var ls = b.lines;
    var ss = Math.max(9, Math.floor(11*dpr/2));
    ctx.font = '500 '+ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    var slotH = (b.h*0.78) / ls.length;
    ls.forEach(function(lbl, i){
      var ly = b.y + b.h*0.22 + slotH*(i+0.5);
      // dot
      ctx.beginPath(); ctx.arc(blx(b)+14*dpr, ly, 3*dpr, 0, Math.PI*2);
      ctx.fillStyle = rgba(b.colD, 0.55); ctx.fill();
      // label
      ctx.fillStyle = b.colD;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, blx(b)+24*dpr, ly);
      // divider between items (not after last)
      if(i < ls.length-1){
        ctx.beginPath();
        ctx.moveTo(blx(b)+10*dpr, b.y+b.h*0.22+slotH*(i+1));
        ctx.lineTo(brx(b)-10*dpr, b.y+b.h*0.22+slotH*(i+1));
        ctx.strokeStyle = rgba(b.colD, 0.10); ctx.lineWidth = dpr*0.5; ctx.stroke();
      }
    });
  }

  function drawReviewBox(){
    var b=REVIEW_BOX, hl=b._hl||0;
    var r=12*dpr, x=blx(b), y=b.y;
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle = rgba(b.col, 0.12+hl*0.14); ctx.fill();
    ctx.strokeStyle = rgba(b.colD, 0.45+hl*0.4);
    ctx.lineWidth = dpr*(hl?2:1);
    ctx.setLineDash([4*dpr,3*dpr]); ctx.stroke(); ctx.setLineDash([]);

    // Person icon
    var cx=b.x, cy=b.y+b.h*0.30, cr=b.h*0.13;
    ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2);
    ctx.fillStyle = rgba(b.colD,0.7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy+cr*1.9,cr*1.6,Math.PI,0);
    ctx.fillStyle = rgba(b.colD,0.35); ctx.fill();

    var fs = Math.max(10, Math.floor(12*dpr/2));
    ctx.fillStyle = b.colD;
    ctx.font = '600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y+b.h*0.74);
    var ss = Math.max(8, Math.floor(9*dpr/2));
    ctx.fillStyle = C.muted;
    ctx.font = ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y+b.h*0.89);
  }

  function drawPlatform(){
    var p=12*dpr, m=MODS[0], ml=MODS[MODS.length-1];
    var x=blx(m)-p, y=m.y-p, w=m.w+p*2, h=ml.y+ml.h-m.y+p*2;
    ctx.beginPath(); ctx.roundRect(x,y,w,h,14*dpr);
    ctx.fillStyle = rgba(C.teal,0.03); ctx.fill();
    ctx.strokeStyle = rgba(C.tealD,0.18); ctx.lineWidth = dpr;
    ctx.setLineDash([6*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    var ts = Math.max(9, Math.floor(10*dpr/2));
    ctx.fillStyle = rgba(C.tealD,0.5);
    ctx.font = '500 '+ts+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Payment automation platform', m.x, y+5*dpr);
  }

  function lbl(text, x, y, col, align){
    var fs = Math.max(7, Math.floor(8.5*dpr/2));
    ctx.font = '500 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillStyle = rgba(col, 0.85);
    ctx.textAlign = align||'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function drawConnectors(){
    ctx.setLineDash([4*dpr,4*dpr]);
    ctx.lineWidth = dpr*0.7;
    var en=MODS[2], stp=MODS[3], rv=REVIEW_BOX, rq=REJECT_BOX, ex=EXEC_BOX;

    // Sources → Normalize
    ctx.strokeStyle = rgba(C.gray, 0.2);
    SRC.forEach(function(s){
      var m=MODS[0], sx=brx(s), sy=bcy(s), tx=blx(m), ty=bcy(m);
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.bezierCurveTo(sx+W*0.05,sy, tx-W*0.05,ty, tx,ty);
      ctx.stroke();
    });

    // Module chain norm→cfg→en→stp
    ctx.strokeStyle = rgba(C.gray, 0.2);
    for(var i=0;i<MODS.length-1;i++){
      var a=MODS[i], b=MODS[i+1];
      ctx.beginPath(); ctx.moveTo(a.x,bbot(a)); ctx.lineTo(b.x,btop(b)); ctx.stroke();
    }

    // Enable/Disable → Reject Queue (horizontal right)
    ctx.strokeStyle = rgba(C.redD, 0.35);
    ctx.beginPath();
    ctx.moveTo(brx(en), bcy(en));
    ctx.bezierCurveTo(brx(en)+W*0.08, bcy(en), blx(rq), bcy(rq), blx(rq), bcy(rq));
    ctx.stroke();
    lbl('rejected', brx(en)+W*0.04, bcy(en)-H*0.022, C.redD);

    // STP → Execution DIRECT (thick, prominent)
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(C.blueD, 0.4);
    ctx.lineWidth = dpr*1.8;
    ctx.beginPath();
    ctx.moveTo(brx(stp), bcy(stp));
    ctx.bezierCurveTo(brx(stp)+W*0.08, bcy(stp), blx(ex), bcy(ex), blx(ex), bcy(ex));
    ctx.stroke();
    ctx.lineWidth = dpr*0.7;
    ctx.setLineDash([4*dpr,4*dpr]);
    lbl('direct STP — most wires', brx(stp)+W*0.05, bcy(stp)-H*0.028, C.blueD);

    // STP → Human Review (exceptions, thinner)
    ctx.strokeStyle = rgba(C.orangeD, 0.3);
    ctx.beginPath();
    ctx.moveTo(brx(stp), bcy(stp)+H*0.028);
    ctx.bezierCurveTo(brx(stp)+W*0.07, bcy(stp)+H*0.028, blx(rv), bcy(rv), blx(rv), bcy(rv));
    ctx.stroke();
    lbl('exceptions', brx(stp)+W*0.04, bcy(stp)+H*0.055, C.orangeD);

    // Human Review → Reject Queue (straight up)
    ctx.strokeStyle = rgba(C.redD, 0.28);
    ctx.beginPath();
    ctx.moveTo(rv.x, btop(rv));
    ctx.lineTo(rq.x, bbot(rq));
    ctx.stroke();
    lbl('rejected', blx(rv)-W*0.005, btop(rv)-H*0.02, C.redD, 'right');

    // Human Review → Execution (approved)
    ctx.strokeStyle = rgba(C.blueD, 0.28);
    ctx.beginPath();
    ctx.moveTo(brx(rv), bcy(rv));
    ctx.bezierCurveTo(brx(rv)+W*0.04, bcy(rv), blx(ex), bcy(ex)+ex.h*0.65, blx(ex), bcy(ex)+ex.h*0.65);
    ctx.stroke();
    lbl('approved', brx(rv)+W*0.025, bcy(rv)+H*0.025, C.tealD);

    ctx.setLineDash([]);
  }

  // PHASES:
  // 0   src entry → norm
  // 1-4 modules (norm=1,cfg=2,en=3,stp=4)
  // 5   stp → exec direct OR stp → review
  // 6   centre of exec (direct done) OR centre of review
  // 7   review → exec (approved)
  // 8   REJECTED → reject queue
  // 9   DONE

  function Particle(si){
    var s=SRC[si];
    this.phase=0; this.t=0;
    this.speed=0.013+Math.random()*0.007;
    this.col=s.col; this.size=dpr*(2.2+Math.random()*0.8);
    this.sx=s.x+s.w/2; this.sy=bcy(s);
    this.tx=0; this.ty=0;
    var r=Math.random();
    if(r<0.15)      {this.rejectAt=3; this.direct=false;}
    else if(r<0.25) {this.rejectAt=6; this.direct=false;}
    else            {this.rejectAt=99;this.direct=true;}
    this.setTarget();
  }

  Particle.prototype.setTarget=function(){
    var m0=MODS[0], ex=EXEC_BOX, rv=REVIEW_BOX, rq=REJECT_BOX;
    if(this.phase===0)                  {this.tx=blx(m0); this.ty=bcy(m0);}
    else if(this.phase>=1&&this.phase<=4){var m=MODS[this.phase-1];this.tx=m.x;this.ty=bcy(m);}
    else if(this.phase===5){
      if(this.direct)                   {this.tx=blx(ex); this.ty=bcy(ex);}
      else                              {this.tx=blx(rv); this.ty=bcy(rv);}
    }
    else if(this.phase===6){
      if(this.direct)                   {this.tx=ex.x;    this.ty=bcy(ex);}
      else                              {this.tx=rv.x;    this.ty=bcy(rv);}
    }
    else if(this.phase===7)             {this.tx=blx(ex); this.ty=bcy(ex)+ex.h*0.65;}
    else if(this.phase===8)             {this.tx=rq.x;    this.ty=bcy(rq);}
  };

  Particle.prototype.update=function(){
    this.t+=this.speed;
    if(this.t>=1){
      this.t=0; this.sx=this.tx; this.sy=this.ty; this.phase++;

      if(this.phase===4&&this.rejectAt===3){
        this.col=C.red; this.phase=8;
        MODS[2]._hl=1;
        rejectCount++;
        var r1=document.getElementById('rejectCount'); if(r1)r1.textContent=rejectCount;
      }
      else if(this.phase===7&&this.rejectAt===6){
        this.col=C.red; this.phase=8;
        REVIEW_BOX._hl=1;
        rejectCount++;
        var r2=document.getElementById('rejectCount'); if(r2)r2.textContent=rejectCount;
      }
      else if(this.phase===7&&this.direct){
        EXEC_BOX._hl=1; wireCount++;
        var wl=document.getElementById('wireCount'); if(wl)wl.textContent=wireCount;
        return true;
      }
      else if(this.phase===8&&!this.direct&&this.rejectAt===99){
        EXEC_BOX._hl=1; wireCount++;
        var wl2=document.getElementById('wireCount'); if(wl2)wl2.textContent=wireCount;
        return true;
      }
      else if(this.phase>=9){return true;}

      if(this.phase>=1&&this.phase<=4) MODS[this.phase-1]._hl=1;
      if(this.phase===6&&!this.direct) REVIEW_BOX._hl=1;
      if(this.phase===8) REJECT_BOX._hl=1;
      this.setTarget();
    }
    return false;
  };

  Particle.prototype.draw=function(){
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
    if(idx>=0)for(var i=0;i<3;i++)(function(ii){setTimeout(function(){particles.push(new Particle(idx));},ii*220);})(i);
  }
  function fireAll(){['api','file','zday'].forEach(fireSource);}
  function scheduleAuto(){
    if(!autoMode)return;
    fireSource(['api','file','zday','api','file','api'][Math.floor(Math.random()*6)]);
    autoTimer=setTimeout(scheduleAuto,750+Math.random()*650);
  }
  function toggleAuto(){
    autoMode=!autoMode;
    var btn=document.getElementById('autoBtn');
    if(btn){btn.textContent='Auto: '+(autoMode?'ON':'OFF');if(autoMode)btn.classList.add('active');else btn.classList.remove('active');}
    if(autoMode)scheduleAuto(); else clearTimeout(autoTimer);
  }

  function loop(){
    ctx.clearRect(0,0,W,H);
    drawConnectors();
    drawPlatform();
    [REVIEW_BOX,REJECT_BOX,EXEC_BOX].concat(MODS).forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.025);});
    SRC.forEach(function(b){drawBox(b,0);});
    MODS.forEach(function(b){drawBox(b,b._hl);});
    drawBox(REJECT_BOX, REJECT_BOX._hl);
    drawReviewBox();
    drawExecBox();
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    requestAnimationFrame(loop);
  }

  var btnMap={btnApi:'api',btnFile:'file',btnZday:'zday'};
  Object.keys(btnMap).forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('click',function(){fireSource(btnMap[id]);});
  });
  var btnAll=document.getElementById('btnAll');
  var btnAuto=document.getElementById('autoBtn');
  if(btnAll) btnAll.addEventListener('click',fireAll);
  if(btnAuto)btnAuto.addEventListener('click',toggleAuto);
  window.addEventListener('resize',function(){layout();});

  layout(); loop(); scheduleAuto();
});
