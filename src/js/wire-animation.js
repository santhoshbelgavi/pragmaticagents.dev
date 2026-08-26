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
  var SRC=[], MODS=[], EXEC=[];
  var REJECT_BOX=null, REVIEW_BOX=null, TMS_BOX=null;

  // helpers
  function rgba(hex,a){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
  function bcy(b){return b.y+b.h/2;}
  function brx(b){return b.x+b.w/2;}
  function blx(b){return b.x-b.w/2;}
  function btop(b){return b.y;}
  function bbot(b){return b.y+b.h;}

  function layout(){
    var cw=canvas.parentElement.clientWidth-48;
    var ch=560;
    canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr); canvas.height=Math.floor(ch*dpr);
    W=canvas.width; H=canvas.height;

    var srcX   = W*0.08;
    var modX   = W*0.34;
    var rColX  = W*0.72;  // reject queue + review column
    var execX  = W*0.92;  // SWIFT + bank apis

    var gap=H*0.022;
    var pad=H*0.05;

    // ── Sources (left, vertically centered in middle 60% of canvas)
    var sh=(H*0.55-gap*2)/3;
    var srcTop=H*0.22;
    SRC=[
      {id:'api', label:'REST APIs',     sub:'real-time', x:srcX,y:srcTop,           w:W*0.12,h:sh,col:C.amber, colD:C.amberD},
      {id:'file',label:'Flat files',    sub:'batch',     x:srcX,y:srcTop+sh+gap,    w:W*0.12,h:sh,col:C.amber, colD:C.amberD},
      {id:'zday',label:'0-day',         sub:'same-day',  x:srcX,y:srcTop+sh*2+gap*2,w:W*0.12,h:sh,col:C.amber, colD:C.amberD},
    ];

    // ── Platform modules (center column)
    var mh=(H*0.82-gap*3)/4;
    var modTop=H*0.05;
    MODS=[
      {id:'norm',label:'Normalize data',      sub:'unify all source formats',              x:modX,y:modTop,             w:W*0.38,h:mh,col:C.amber, colD:C.amberD, _hl:0},
      {id:'cfg', label:'Configuration module',sub:'funds · teams · SSIs — data not code', x:modX,y:modTop+mh+gap,      w:W*0.38,h:mh,col:C.purple,colD:C.purpleD,_hl:0},
      {id:'en',  label:'Enable / disable',    sub:'some pass · some reject',               x:modX,y:modTop+mh*2+gap*2,  w:W*0.38,h:mh,col:C.red,   colD:C.redD,   _hl:0},
      {id:'stp', label:'STP core engine',     sub:'validate · match SSI · route',          x:modX,y:modTop+mh*3+gap*3,  w:W*0.38,h:mh,col:C.teal,  colD:C.tealD,  _hl:0},
    ];

    // ── Right column: Reject Queue (top) → Human Review (middle)
    var rqH=H*0.12, rvH=H*0.17, rcGap=H*0.055;
    var rcTop=H*0.05;

    REJECT_BOX={
      label:'Reject queue', sub:'requires investigation',
      x:rColX, y:rcTop, w:W*0.21, h:rqH,
      col:C.red, colD:C.redD, _hl:0
    };
    REVIEW_BOX={
      label:'Human review', sub:'approves or rejects',
      x:rColX, y:rcTop+rqH+rcGap, w:W*0.21, h:rvH,
      col:C.orange, colD:C.orangeD, _hl:0
    };

    // ── TMS — far top-right, direct STP bypass lane
    TMS_BOX={
      label:'Kyriba TMS', sub:'direct STP',
      x:execX, y:rcTop, w:W*0.11, h:rqH+rcGap+rvH,  // spans full reject+review height
      col:C.blue, colD:C.blueD, _hl:0
    };

    // ── Other exec rails below review box
    var execTop=bbot(REVIEW_BOX)+rcGap;
    var execAvail=H-execTop-H*0.03;
    var eh=(execAvail-gap)/2;
    EXEC=[
      {id:'swift', label:'SWIFT',     sub:'99.9% of wires', x:execX,y:execTop,       w:W*0.11,h:eh,col:C.blue,colD:C.blueD},
      {id:'bank',  label:'Bank APIs', sub:'direct rails',   x:execX,y:execTop+eh+gap,w:W*0.11,h:eh,col:C.blue,colD:C.blueD},
    ];
  }

  // ── Drawing helpers
  function drawBox(b,hl){
    hl=hl||0;
    var r=7*dpr,x=blx(b),y=b.y;
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=rgba(b.col,0.13+hl*0.15);ctx.fill();
    ctx.strokeStyle=rgba(b.colD,0.5+hl*0.4);
    ctx.lineWidth=dpr*(hl?2:0.9);ctx.stroke();
    var fs=Math.max(10,Math.floor(12*dpr/2));
    ctx.fillStyle=b.colD;
    ctx.font='600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x,b.y+b.h*0.37);
    var ss=Math.max(7,Math.floor(9*dpr/2));
    ctx.fillStyle=C.muted;
    ctx.font=ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub,b.x,b.y+b.h*0.70);
  }

  function drawReviewBox(){
    var b=REVIEW_BOX,hl=b._hl||0;
    var r=36*dpr,x=blx(b),y=b.y;
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=rgba(b.col,0.13+hl*0.15);ctx.fill();
    ctx.strokeStyle=rgba(b.colD,0.5+hl*0.4);
    ctx.lineWidth=dpr*(hl?2:1);
    ctx.setLineDash([4*dpr,3*dpr]);ctx.stroke();ctx.setLineDash([]);
    var cx=b.x,cy=b.y+b.h*0.27,cr=b.h*0.14;
    ctx.beginPath();ctx.arc(cx,cy,cr,0,Math.PI*2);
    ctx.fillStyle=rgba(b.colD,0.7);ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy+cr*1.9,cr*1.6,Math.PI,0);
    ctx.fillStyle=rgba(b.colD,0.35);ctx.fill();
    var fs=Math.max(9,Math.floor(10*dpr/2));
    ctx.fillStyle=b.colD;
    ctx.font='600 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x,b.y+b.h*0.73);
    var ss=Math.max(7,Math.floor(8*dpr/2));
    ctx.fillStyle=C.muted;
    ctx.font=ss+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub,b.x,b.y+b.h*0.89);
  }

  function drawPlatform(){
    var p=10*dpr,m=MODS[0],ml=MODS[MODS.length-1];
    var x=blx(m)-p,y=m.y-p,w=m.w+p*2,h=ml.y+ml.h-m.y+p*2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,12*dpr);
    ctx.fillStyle=rgba(C.teal,0.03);ctx.fill();
    ctx.strokeStyle=rgba(C.tealD,0.18);ctx.lineWidth=dpr;
    ctx.setLineDash([5*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);
    var ts=Math.max(8,Math.floor(9*dpr/2));
    ctx.fillStyle=rgba(C.tealD,0.45);
    ctx.font='500 '+ts+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText('Payment automation platform',m.x,y+4*dpr);
  }

  function label(text,x,y,col,align){
    var fs=Math.max(7,Math.floor(8*dpr/2));
    ctx.font='500 '+fs+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillStyle=rgba(col,0.85);ctx.textAlign=align||'center';ctx.textBaseline='middle';
    ctx.fillText(text,x,y);
  }

  function drawConnectors(){
    var stp=MODS[3],en=MODS[2],rv=REVIEW_BOX,rq=REJECT_BOX,tms=TMS_BOX;
    ctx.setLineDash([4*dpr,4*dpr]);ctx.lineWidth=dpr*0.7;

    // Sources → Normalize
    ctx.strokeStyle=rgba(C.gray,0.2);
    SRC.forEach(function(s){
      var m=MODS[0],sx=brx(s),sy=bcy(s),tx=blx(m),ty=bcy(m);
      ctx.beginPath();ctx.moveTo(sx,sy);
      ctx.bezierCurveTo(sx+W*0.06,sy,tx-W*0.06,ty,tx,ty);ctx.stroke();
    });

    // Module chain norm→cfg→en→stp
    ctx.strokeStyle=rgba(C.gray,0.2);
    for(var i=0;i<MODS.length-1;i++){
      var a=MODS[i],b=MODS[i+1];
      ctx.beginPath();ctx.moveTo(a.x,bbot(a));ctx.lineTo(b.x,btop(b));ctx.stroke();
    }

    // Enable/Disable → Reject Queue (right then up)
    ctx.strokeStyle=rgba(C.redD,0.3);
    ctx.beginPath();
    ctx.moveTo(brx(en),bcy(en));
    ctx.bezierCurveTo(brx(en)+W*0.07,bcy(en),blx(rq),bcy(rq),blx(rq),bcy(rq));
    ctx.stroke();
    label('rejected',brx(en)+W*0.035,bcy(en)-H*0.022,C.redD,'center');

    // STP → TMS (direct, skip review — most wires)
    ctx.strokeStyle=rgba(C.blueD,0.3);
    ctx.beginPath();
    ctx.moveTo(brx(stp),bcy(stp));
    ctx.bezierCurveTo(brx(stp)+W*0.05,bcy(stp),blx(tms),bcy(tms),blx(tms),bcy(tms));
    ctx.stroke();
    label('direct STP',brx(stp)+W*0.04,bcy(stp)-H*0.025,C.blueD,'center');

    // STP → Human Review (exception wires)
    ctx.strokeStyle=rgba(C.orangeD,0.3);
    ctx.beginPath();
    ctx.moveTo(brx(stp),bcy(stp)+H*0.025);
    ctx.bezierCurveTo(brx(stp)+W*0.06,bcy(stp)+H*0.025,blx(rv),bcy(rv),blx(rv),bcy(rv));
    ctx.stroke();
    label('exceptions',brx(stp)+W*0.04,bcy(stp)+H*0.048,C.orangeD,'center');

    // Human Review → Reject Queue (up)
    ctx.strokeStyle=rgba(C.redD,0.25);
    ctx.beginPath();
    ctx.moveTo(rv.x,btop(rv));ctx.lineTo(rq.x,bbot(rq));
    ctx.stroke();
    label('rejected',blx(rv)-W*0.01,bcy(rv)-rv.h*0.38,C.redD,'right');

    // Human Review → SWIFT (approved → down)
    ctx.strokeStyle=rgba(C.blueD,0.2);
    EXEC.forEach(function(e){
      ctx.beginPath();
      ctx.moveTo(rv.x,bbot(rv));
      ctx.bezierCurveTo(rv.x,bbot(rv)+H*0.04,e.x,btop(e)-H*0.04,e.x,btop(e));
      ctx.stroke();
    });
    label('approved',rv.x,bbot(rv)+H*0.028,C.tealD,'center');

    ctx.setLineDash([]);
  }

  // ── PHASES
  // 0  src → norm entry
  // 1-4 through modules
  // 3 = enable/disable — may reject (→ phase 8)
  // 4 = stp centre
  // 5a direct STP → TMS (most)
  // 5b exceptions → review entry
  // 6  in review — may reject (→ phase 8)
  // 7  review → exec (SWIFT/bank)
  // 8  REJECTED → reject queue
  // 9  DONE

  function Particle(si){
    var s=SRC[si];
    this.phase=0;this.t=0;
    this.speed=0.013+Math.random()*0.007;
    this.col=s.col;this.size=dpr*(2.2+Math.random()*0.8);
    this.sx=s.x+s.w/2;this.sy=bcy(s);
    this.tx=0;this.ty=0;
    // fate: 15% reject at en/dis, 10% go to review (of which 30% reject), 75% direct TMS
    var r=Math.random();
    if(r<0.15)       {this.rejectAt=3;this.directTMS=false;}
    else if(r<0.25)  {this.rejectAt=6;this.directTMS=false;}  // goes to review, may reject
    else             {this.rejectAt=99;this.directTMS=true;}   // direct TMS
    this.setTarget();
  }

  Particle.prototype.setTarget=function(){
    var m0=MODS[0];
    if(this.phase===0)            {this.tx=blx(m0);            this.ty=bcy(m0);}
    else if(this.phase>=1&&this.phase<=4){var m=MODS[this.phase-1];this.tx=m.x;this.ty=bcy(m);}
    else if(this.phase===5){
      if(this.directTMS)          {this.tx=blx(TMS_BOX);       this.ty=bcy(TMS_BOX);}
      else                        {this.tx=blx(REVIEW_BOX);    this.ty=bcy(REVIEW_BOX);}
    }
    else if(this.phase===6)       {this.tx=REVIEW_BOX.x;       this.ty=bcy(REVIEW_BOX);}
    else if(this.phase===7){
      var e=EXEC[Math.floor(Math.random()*EXEC.length)];
      this.tx=e.x;this.ty=btop(e);
    }
    else if(this.phase===8)       {this.tx=REJECT_BOX.x;       this.ty=bcy(REJECT_BOX);}
    else if(this.phase==='tms')   {this.tx=TMS_BOX.x;          this.ty=bcy(TMS_BOX);}
  };

  Particle.prototype.update=function(){
    this.t+=this.speed;
    if(this.t>=1){
      this.t=0;this.sx=this.tx;this.sy=this.ty;this.phase++;

      // reject at enable/disable
      if(this.phase===4&&this.rejectAt===3){
        this.col=C.red;this.phase=8;
        MODS[2]._hl=1;
        rejectCount++;
        var r1=document.getElementById('rejectCount');if(r1)r1.textContent=rejectCount;
      }
      // after stp (phase 5) — direct TMS or review
      else if(this.phase===5){
        if(this.directTMS){TMS_BOX._hl=1;}
        // else goes to review
      }
      // done at TMS (direct path)
      else if(this.phase===6&&this.directTMS){
        wireCount++;
        TMS_BOX._hl=1;
        var wl=document.getElementById('wireCount');if(wl)wl.textContent=wireCount;
        return true;
      }
      // reject at review
      else if(this.phase===7&&this.rejectAt===6){
        this.col=C.red;this.phase=8;
        REVIEW_BOX._hl=1;
        rejectCount++;
        var r2=document.getElementById('rejectCount');if(r2)r2.textContent=rejectCount;
      }
      // done arriving at exec
      else if(this.phase===8&&this.rejectAt===99){
        wireCount++;
        var wl2=document.getElementById('wireCount');if(wl2)wl2.textContent=wireCount;
        return true;
      }
      // done arriving at reject queue
      else if(this.phase===9){return true;}
      else if(this.phase>9){return true;}

      if(this.phase>=1&&this.phase<=4)MODS[this.phase-1]._hl=1;
      if(this.phase===6&&!this.directTMS)REVIEW_BOX._hl=1;
      if(this.phase===8)REJECT_BOX._hl=1;
      this.setTarget();
    }
    return false;
  };

  Particle.prototype.draw=function(){
    var ease=function(t){return t<0.5?2*t*t:-1+(4-2*t)*t;};
    var et=ease(this.t);
    var mx=(this.sx+this.tx)/2,my=(this.sy+this.ty)/2;
    var bx=(1-et)*(1-et)*this.sx+2*(1-et)*et*mx+et*et*this.tx;
    var by=(1-et)*(1-et)*this.sy+2*(1-et)*et*my+et*et*this.ty;
    for(var i=3;i>=0;i--){
      var tt=Math.max(0,this.t-i*0.05),e2=ease(tt);
      var bx2=(1-e2)*(1-e2)*this.sx+2*(1-e2)*e2*mx+e2*e2*this.tx;
      var by2=(1-e2)*(1-e2)*this.sy+2*(1-e2)*e2*my+e2*e2*this.ty;
      ctx.beginPath();ctx.arc(bx2,by2,this.size*(0.25+i*0.15),0,Math.PI*2);
      ctx.fillStyle=rgba(this.col,0.1*(4-i));ctx.fill();
    }
    ctx.beginPath();ctx.arc(bx,by,this.size,0,Math.PI*2);
    ctx.fillStyle=this.col;ctx.fill();
    ctx.beginPath();ctx.arc(bx,by,this.size*2.2,0,Math.PI*2);
    ctx.fillStyle=rgba(this.col,0.18);ctx.fill();
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
    if(autoMode)scheduleAuto();else clearTimeout(autoTimer);
  }

  function loop(){
    ctx.clearRect(0,0,W,H);
    drawConnectors();
    drawPlatform();
    [].concat(MODS,[REVIEW_BOX,REJECT_BOX,TMS_BOX]).forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.025);});
    SRC.forEach(function(b){drawBox(b,0);});
    MODS.forEach(function(b){drawBox(b,b._hl);});
    drawBox(REJECT_BOX,REJECT_BOX._hl);
    drawReviewBox();
    drawBox(TMS_BOX,TMS_BOX._hl);
    EXEC.forEach(function(b){drawBox(b,0);});
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
  if(btnAll)btnAll.addEventListener('click',fireAll);
  if(btnAuto)btnAuto.addEventListener('click',toggleAuto);
  window.addEventListener('resize',function(){layout();});

  layout();loop();scheduleAuto();
});
