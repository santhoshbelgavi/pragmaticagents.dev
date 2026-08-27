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
  var hoveredNode = null;

  var P = {
    bg:'#F7F4EF', panel:'#FFFFFF', border:'rgba(0,0,0,0.07)',
    text:'#1A1714', muted:'#8A8480',
    amber:'#C47A0A',  amberBg:'rgba(196,122,10,0.09)',  amberRing:'rgba(196,122,10,0.22)',
    purple:'#6B5FC0', purpleBg:'rgba(107,95,192,0.09)', purpleRing:'rgba(107,95,192,0.22)',
    teal:'#1A7A5E',   tealBg:'rgba(26,122,94,0.09)',    tealRing:'rgba(26,122,94,0.22)',
    red:'#B03030',    redBg:'rgba(176,48,48,0.08)',     redRing:'rgba(176,48,48,0.22)',
    orange:'#B85A08', orangeBg:'rgba(184,90,8,0.09)',   orangeRing:'rgba(184,90,8,0.22)',
    blue:'#1A5FAA',   blueBg:'rgba(26,95,170,0.09)',    blueRing:'rgba(26,95,170,0.22)',
    pAmber:'#F59E0B', pRed:'#EF4444', pBlue:'#3B82F6', pGreen:'#10B981',
  };

  function rgba(hex,a){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  function bl(b){return b.x-b.w/2;} function br(b){return b.x+b.w/2;}
  function bt(b){return b.y;}        function bb(b){return b.y+b.h;}
  function bcy(b){return b.y+b.h/2;}
  function inside(b,mx,my){return mx>=bl(b)&&mx<=br(b)&&my>=bt(b)&&my<=bb(b);}

  var W,H,SRC=[],MODS=[],REJECT_BOX,REVIEW_BOX,EXEC_BOX,PATHS={};

  function layout(){
    var cw=canvas.parentElement.clientWidth-8, ch=560;
    canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr); canvas.height=Math.floor(ch*dpr);
    W=canvas.width; H=canvas.height;

    var padT=H*0.05, padB=H*0.05;
    var availH=H-padT-padB;
    var gap=H*0.022;

    // Column centres
    var c1=W*0.085, c2=W*0.310, c3=W*0.675, c4=W*0.895;

    // ── Sources: fixed small height, vertically centred across platform
    var sw=W*0.115, sh=H*0.095;  // small fixed height
    var srcSpan=sh*3+gap*2;
    var srcTop=padT+(availH-srcSpan)/2;
    SRC=[
      {id:'api', label:'REST API',  sub:'real-time', x:c1,y:srcTop,            w:sw,h:sh,col:P.amber, bg:P.amberBg, ring:P.amberRing, pc:P.pAmber},
      {id:'file',label:'Flat file', sub:'batch',     x:c1,y:srcTop+sh+gap,     w:sw,h:sh,col:P.amber, bg:P.amberBg, ring:P.amberRing, pc:P.pAmber},
      {id:'zday',label:'0-day',     sub:'same-day',  x:c1,y:srcTop+sh*2+gap*2, w:sw,h:sh,col:P.amber, bg:P.amberBg, ring:P.amberRing, pc:P.pAmber},
    ];

    // ── Platform modules: fill full available height
    var mw=W*0.345, mh=(availH-gap*3)/4;
    MODS=[
      {id:'norm',label:'Normalize data',       sub:'Unify all source formats into one shape',      x:c2,y:padT,             w:mw,h:mh,col:P.amber, bg:P.amberBg, ring:P.amberRing, _hl:0,_pulse:0},
      {id:'cfg', label:'Configuration',        sub:'Funds · teams · SSIs — added as data, not code',x:c2,y:padT+mh+gap,      w:mw,h:mh,col:P.purple,bg:P.purpleBg,ring:P.purpleRing,_hl:0,_pulse:0},
      {id:'en',  label:'Enable / Disable',     sub:'Disabled funds reject here · any granularity',  x:c2,y:padT+mh*2+gap*2, w:mw,h:mh,col:P.red,   bg:P.redBg,   ring:P.redRing,   _hl:0,_pulse:0},
      {id:'stp', label:'STP Core Engine',      sub:'Validate · match SSI · route to execution',    x:c2,y:padT+mh*3+gap*3, w:mw,h:mh,col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  _hl:0,_pulse:0},
    ];

    // ── Right column: Reject Queue (top), gap in middle for direct STP, Human Review (bottom)
    var rw=W*0.220;
    // STP core engine centre is at: padT + mh*3.5 + gap*3 (roughly 75% down availH)
    // Direct STP line targets bcy(EXEC_BOX) = padT + availH*0.5
    // So Human Review must sit BELOW the midpoint — bottom 35% of availH
    var rqH = availH * 0.24;   // Reject Queue — compact at top
    var rvH = availH * 0.32;   // Human Review — bottom third
    var rvTop = padT + availH * 0.62;  // starts at 62% down — well below direct STP line

    REJECT_BOX={id:'rq',label:'Reject Queue', sub:'Requires investigation',
      x:c3, y:padT, w:rw, h:rqH,
      col:P.red, bg:P.redBg, ring:P.redRing, _hl:0, _pulse:0};
    REVIEW_BOX={id:'rv',label:'Human Review', sub:'Approves or rejects flagged wires',
      x:c3, y:rvTop, w:rw, h:rvH,
      col:P.orange, bg:P.orangeBg, ring:P.orangeRing, _hl:0, _pulse:0};

    // ── Execution: full height far right
    EXEC_BOX={id:'ex',label:'Execution',lines:['Kyriba TMS','SWIFT','Bank APIs'],
      x:c4,y:padT,w:W*0.135,h:availH,col:P.blue,bg:P.blueBg,ring:P.blueRing,_hl:0,_pulse:0};

    buildPaths();
  }

  function buildPaths(){
    var en=MODS[2],stp=MODS[3],rv=REVIEW_BOX,rq=REJECT_BOX,ex=EXEC_BOX;
    // Direct STP: STP core → Execution, routes through the clear middle gap (top half of exec)
    PATHS.direct    ={sx:br(stp),sy:bcy(stp),   cx1:br(stp)+W*0.07,cy1:bcy(stp),      cx2:bl(ex)-W*0.03,cy2:ex.y+ex.h*0.35, tx:bl(ex),ty:ex.y+ex.h*0.35};
    // Exceptions: STP → Human Review (bottom)
    PATHS.review    ={sx:br(stp),sy:bcy(stp)+H*0.02,cx1:br(stp)+W*0.05,cy1:bcy(stp)+H*0.08,cx2:bl(rv)-W*0.03,cy2:bcy(rv), tx:bl(rv),ty:bcy(rv)};
    // Enable/Disable → Reject Queue (top right)
    PATHS.reject_en ={sx:br(en), sy:bcy(en),    cx1:br(en)+W*0.07, cy1:bcy(en),       cx2:bl(rq)-W*0.02,cy2:bcy(rq),  tx:bl(rq),ty:bcy(rq)};
    // Review → Reject Queue (up — review is now lower, reject is at top)
    PATHS.reject_rv ={sx:rv.x,   sy:bt(rv),     cx1:rv.x,          cy1:bt(rv)-H*0.08, cx2:rq.x,         cy2:bb(rq)+H*0.04, tx:rq.x,ty:bb(rq)};
    // Review → Execution approved (right into lower portion of exec)
    PATHS.approved  ={sx:br(rv), sy:bcy(rv),    cx1:br(rv)+W*0.04, cy1:bcy(rv),       cx2:bl(ex)-W*0.02,cy2:ex.y+ex.h*0.72, tx:bl(ex),ty:ex.y+ex.h*0.72};
  }

  function pathPoint(p,t){
    var e=t<0.5?2*t*t:-1+(4-2*t)*t;
    return{
      x:(1-e)*(1-e)*(1-e)*p.sx+3*(1-e)*(1-e)*e*p.cx1+3*(1-e)*e*e*p.cx2+e*e*e*p.tx,
      y:(1-e)*(1-e)*(1-e)*p.sy+3*(1-e)*(1-e)*e*p.cy1+3*(1-e)*e*e*p.cy2+e*e*e*p.ty
    };
  }

  // ── Font sizes — all based on canvas pixel size, readable
  function fs(base){ return Math.max(base*dpr*0.62, base*0.9); }

  function drawNode(b,hl){
    hl=hl||b._hl||0;
    var r=9*dpr, x=bl(b), y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05){ctx.shadowBlur=20*dpr*hl;ctx.shadowColor=rgba(b.col,0.3*hl);}
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=b.bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65+hl*0.25):(hov?rgba(b.col,0.55):rgba(b.col,0.25));
    ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);ctx.stroke();
    ctx.shadowBlur=0;ctx.shadowColor='transparent';

    if(b._pulse>0){
      ctx.beginPath();ctx.roundRect(x-b._pulse*10*dpr,y-b._pulse*10*dpr,b.w+b._pulse*20*dpr,b.h+b._pulse*20*dpr,r+b._pulse*10*dpr);
      ctx.strokeStyle=rgba(b.col,b._pulse*0.35);ctx.lineWidth=dpr*1.5;ctx.stroke();
    }

    // Label — bigger, bolder
    ctx.fillStyle=b.col;
    ctx.font='700 '+fs(15)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x,b.y+b.h*0.36);

    // Sub — readable size
    ctx.fillStyle=P.muted;
    ctx.font='400 '+fs(11)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.fillText(b.sub,b.x,b.y+b.h*0.66);
  }

  function drawReviewNode(){
    var b=REVIEW_BOX,hl=b._hl||0;
    var r=10*dpr,x=bl(b),y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05){ctx.shadowBlur=20*dpr*hl;ctx.shadowColor=rgba(b.col,0.3*hl);}
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=b.bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65):(hov?rgba(b.col,0.55):rgba(b.col,0.25));
    ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);
    ctx.setLineDash([5*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);
    ctx.shadowBlur=0;ctx.shadowColor='transparent';

    if(b._pulse>0){
      ctx.beginPath();ctx.roundRect(x-b._pulse*10*dpr,y-b._pulse*10*dpr,b.w+b._pulse*20*dpr,b.h+b._pulse*20*dpr,r+b._pulse*10*dpr);
      ctx.strokeStyle=rgba(b.col,b._pulse*0.35);ctx.lineWidth=dpr*1.5;ctx.stroke();
    }

    // Person icon — small, top of box
    var cx=b.x, cy=b.y+b.h*0.22, cr=Math.min(b.h*0.09, b.w*0.08);
    ctx.beginPath();ctx.arc(cx,cy,cr,0,Math.PI*2);
    ctx.fillStyle=rgba(b.col,0.55);ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy+cr*2.0,cr*1.5,Math.PI,0);
    ctx.fillStyle=rgba(b.col,0.28);ctx.fill();

    ctx.fillStyle=b.col;
    ctx.font='700 '+fs(14)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x,b.y+b.h*0.60);
    ctx.fillStyle=P.muted;
    ctx.font='400 '+fs(11)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.fillText(b.sub,b.x,b.y+b.h*0.80);
  }

  function drawExecNode(){
    var b=EXEC_BOX,hl=b._hl||0;
    var r=9*dpr,x=bl(b),y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05){ctx.shadowBlur=20*dpr*hl;ctx.shadowColor=rgba(b.col,0.3*hl);}
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=b.bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65):(hov?rgba(b.col,0.55):rgba(b.col,0.25));
    ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);ctx.stroke();
    ctx.shadowBlur=0;ctx.shadowColor='transparent';

    if(b._pulse>0){
      ctx.beginPath();ctx.roundRect(x-b._pulse*10*dpr,y-b._pulse*10*dpr,b.w+b._pulse*20*dpr,b.h+b._pulse*20*dpr,r+b._pulse*10*dpr);
      ctx.strokeStyle=rgba(b.col,b._pulse*0.35);ctx.lineWidth=dpr*1.5;ctx.stroke();
    }

    ctx.fillStyle=b.col;
    ctx.font='700 '+fs(14)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x,b.y+b.h*0.09);

    ctx.beginPath();ctx.moveTo(bl(b)+12*dpr,b.y+b.h*0.17);ctx.lineTo(br(b)-12*dpr,b.y+b.h*0.17);
    ctx.strokeStyle=rgba(b.col,0.15);ctx.lineWidth=dpr*0.8;ctx.stroke();

    var ls=b.lines, slotH=(b.h*0.83)/ls.length;
    ls.forEach(function(lbl,i){
      var ly=b.y+b.h*0.17+slotH*(i+0.5);
      ctx.beginPath();ctx.arc(bl(b)+16*dpr,ly,3.5*dpr,0,Math.PI*2);
      ctx.fillStyle=rgba(b.col,0.5);ctx.fill();
      ctx.fillStyle=b.col;
      ctx.font='500 '+fs(12)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
      ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(lbl,bl(b)+28*dpr,ly);
      if(i<ls.length-1){
        ctx.beginPath();ctx.moveTo(bl(b)+12*dpr,b.y+b.h*0.17+slotH*(i+1));ctx.lineTo(br(b)-12*dpr,b.y+b.h*0.17+slotH*(i+1));
        ctx.strokeStyle=rgba(b.col,0.10);ctx.lineWidth=dpr*0.6;ctx.stroke();
      }
    });
  }

  function drawPlatformBox(){
    var p=14*dpr,m=MODS[0],ml=MODS[MODS.length-1];
    var x=bl(m)-p,y=bt(m)-p,w=m.w+p*2,h=bb(ml)-bt(m)+p*2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,16*dpr);
    ctx.fillStyle='rgba(26,122,94,0.022)';ctx.fill();
    ctx.strokeStyle=rgba(P.teal,0.14);ctx.lineWidth=dpr;
    ctx.setLineDash([7*dpr,5*dpr]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=rgba(P.teal,0.5);
    ctx.font='500 '+fs(10)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText('Payment automation platform',m.x,y+5*dpr);
  }

  function arrowHead(p,col){
    var t1=pathPoint(p,0.97),t2=pathPoint(p,1.0);
    var ang=Math.atan2(t2.y-t1.y,t2.x-t1.x),sz=5.5*dpr;
    ctx.beginPath();ctx.moveTo(t2.x,t2.y);
    ctx.lineTo(t2.x-sz*Math.cos(ang-0.42),t2.y-sz*Math.sin(ang-0.42));
    ctx.lineTo(t2.x-sz*Math.cos(ang+0.42),t2.y-sz*Math.sin(ang+0.42));
    ctx.closePath();ctx.fillStyle=rgba(col,0.5);ctx.fill();
  }

  function edgePill(text,x,y,col){
    ctx.font='600 '+fs(9)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    var tw=ctx.measureText(text).width+10*dpr, th=13*dpr;
    ctx.beginPath();ctx.roundRect(x-tw/2,y-th/2,tw,th,5*dpr);
    ctx.fillStyle=rgba(col,0.10);ctx.fill();
    ctx.strokeStyle=rgba(col,0.25);ctx.lineWidth=dpr*0.6;ctx.stroke();
    ctx.fillStyle=rgba(col,0.85);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(text,x,y);
  }

  function drawConnectors(){
    var en=MODS[2],stp=MODS[3],rv=REVIEW_BOX,rq=REJECT_BOX;

    function bezLine(p,col,w,dash){
      ctx.beginPath();ctx.moveTo(p.sx,p.sy);
      ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);
      ctx.strokeStyle=rgba(col,0.22);ctx.lineWidth=dpr*(w||0.9);
      if(dash)ctx.setLineDash([5*dpr,4*dpr]);else ctx.setLineDash([]);
      ctx.stroke();ctx.setLineDash([]);
    }

    // Sources → Normalize
    SRC.forEach(function(s){
      var m=MODS[0];
      ctx.beginPath();ctx.moveTo(br(s),bcy(s));
      ctx.bezierCurveTo(br(s)+W*0.04,bcy(s),bl(m)-W*0.02,bcy(m),bl(m),bcy(m));
      ctx.strokeStyle=rgba(P.amber,0.18);ctx.lineWidth=dpr*0.8;
      ctx.setLineDash([5*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);
    });

    // Module chain
    for(var i=0;i<MODS.length-1;i++){
      var a=MODS[i],b=MODS[i+1];
      ctx.beginPath();ctx.moveTo(a.x,bb(a));ctx.lineTo(b.x,bt(b));
      ctx.strokeStyle=rgba(P.muted,0.18);ctx.lineWidth=dpr*0.8;
      ctx.setLineDash([5*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);
    }

    // en → reject queue
    bezLine(PATHS.reject_en,P.red,0.9,true);
    arrowHead(PATHS.reject_en,P.red);
    edgePill('rejected',br(en)+W*0.04,bcy(en)-H*0.03,P.red);

    // STP → Execution (direct — thicker, solid)
    bezLine(PATHS.direct,P.blue,2.0,false);
    arrowHead(PATHS.direct,P.blue);
    edgePill('direct STP — most wires',br(stp)+W*0.052,bcy(stp)-H*0.030,P.blue);

    // STP → Review
    bezLine(PATHS.review,P.orange,0.9,true);
    arrowHead(PATHS.review,P.orange);
    edgePill('exceptions',br(stp)+W*0.042,bcy(stp)+H*0.072,P.orange);

    // rv → reject queue
    bezLine(PATHS.reject_rv,P.red,0.9,true);
    arrowHead(PATHS.reject_rv,P.red);
    edgePill('rejected',rv.x,bt(rv)-H*0.030,P.red);

    // rv → execution (approved)
    bezLine(PATHS.approved,P.teal,0.9,true);
    arrowHead(PATHS.approved,P.teal);
    edgePill('approved',br(rv)+W*0.028,bcy(rv)-H*0.024,P.teal);
  }

  function drawLiveCounter(){
    var pad=12*dpr, y=pad;
    var fsize=fs(10);
    ctx.font='600 '+fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    var doneText='✓ '+wireCount+' executed', rejText='✗ '+rejectCount+' rejected';
    var dw=ctx.measureText(doneText).width+14*dpr, rw=ctx.measureText(rejText).width+14*dpr;
    var bh=16*dpr, gap=6*dpr, x=W-pad;

    ctx.beginPath();ctx.roundRect(x-dw,y,dw,bh,5*dpr);
    ctx.fillStyle=rgba(P.teal,0.10);ctx.fill();
    ctx.strokeStyle=rgba(P.teal,0.2);ctx.lineWidth=dpr*0.7;ctx.stroke();
    ctx.fillStyle=P.teal;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(doneText,x-dw/2,y+bh/2);

    ctx.beginPath();ctx.roundRect(x-dw-gap-rw,y,rw,bh,5*dpr);
    ctx.fillStyle=rgba(P.red,0.10);ctx.fill();
    ctx.strokeStyle=rgba(P.red,0.2);ctx.lineWidth=dpr*0.7;ctx.stroke();
    ctx.fillStyle=P.red;
    ctx.fillText(rejText,x-dw-gap-rw/2,y+bh/2);
  }

  var TOOLTIPS={
    norm:'All formats — REST JSON, flat CSV, real-time messages — are normalised into one wire instruction shape before processing.',
    cfg:'Funds, teams, and SSIs are registered as configuration. Adding a new fund or payment source requires zero code changes.',
    en:'Funds can be enabled or disabled individually — per fund, per team, or any combination. Disabled funds reject here.',
    stp:'The core validates the instruction, matches the SSI, and routes to direct execution or flags for human review.',
    rq:'Rejected wires land here for investigation. Kept separate from the live processing queue. Nothing is lost.',
    rv:'A human reviewer approves or rejects flagged wires. Approved wires continue to execution rails.',
    ex:'Kyriba TMS, SWIFT, and Bank APIs form the unified execution layer. 99.9% of wires exit via SWIFT.',
    api:'Real-time REST API — wire instructions delivered directly from source systems.',
    file:'Flat file batch — CSV or fixed-width files ingested and normalised on arrival.',
    zday:'Same-day payment sources — real-time 0-day funds fed directly into the platform.',
  };

  function drawTooltip(b){
    var text=TOOLTIPS[b.id]; if(!text)return;
    var maxW=Math.min(W*0.28,220*dpr);
    var fsize=fs(10);
    ctx.font=fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    var words=text.split(' '),lines=[],cur='';
    words.forEach(function(w){
      var test=cur?cur+' '+w:w;
      if(ctx.measureText(test).width>maxW-16*dpr){lines.push(cur);cur=w;}else cur=test;
    });
    if(cur)lines.push(cur);
    var lh=fsize*1.55,pad=11*dpr,tw=maxW,th=lines.length*lh+pad*2;
    var tx=b.x-tw/2,ty=bb(b)+10*dpr;
    if(tx<4*dpr)tx=4*dpr;
    if(tx+tw>W-4*dpr)tx=W-tw-4*dpr;
    if(ty+th>H-4*dpr)ty=bt(b)-th-10*dpr;
    ctx.shadowBlur=14*dpr;ctx.shadowColor='rgba(0,0,0,0.10)';
    ctx.beginPath();ctx.roundRect(tx,ty,tw,th,8*dpr);
    ctx.fillStyle='#FFFDF9';ctx.fill();
    ctx.shadowBlur=0;ctx.shadowColor='transparent';
    ctx.strokeStyle=rgba(b.col,0.28);ctx.lineWidth=dpr;ctx.stroke();
    ctx.fillStyle=P.text;ctx.textAlign='left';ctx.textBaseline='top';
    lines.forEach(function(l,i){ctx.fillText(l,tx+pad,ty+pad+i*lh);});
  }

  function Particle(si){
    var s=SRC[si];
    this.phase=0;this.t=0;this.speed=0.015+Math.random()*0.008;
    this.col=s.pc;this.size=dpr*(2.0+Math.random()*0.8);
    this.sx=br(s);this.sy=bcy(s);this.tx=0;this.ty=0;
    this.history=[];this.path=null;
    var r=Math.random();
    this.fate=r<0.15?'reject_en':r<0.26?'reject_rv':'direct';
    this.setTarget();
  }

  Particle.prototype.setTarget=function(){
    var m0=MODS[0],ex=EXEC_BOX,rv=REVIEW_BOX,rq=REJECT_BOX;
    if(this.phase===0){this.tx=bl(m0);this.ty=bcy(m0);this.path=null;}
    else if(this.phase>=1&&this.phase<=4){var m=MODS[this.phase-1];this.tx=m.x;this.ty=bcy(m);this.path=null;}
    else if(this.phase===5){
      if(this.fate==='direct'){this.tx=bl(ex);this.ty=bcy(ex);this.path='direct';}
      else{this.tx=bl(rv);this.ty=bcy(rv);this.path='review';}
    }
    else if(this.phase===6){
      if(this.fate==='direct'){this.tx=ex.x;this.ty=bcy(ex);this.path=null;}
      else{this.tx=rv.x;this.ty=bcy(rv);this.path=null;}
    }
    else if(this.phase===7){
      if(this.fate==='reject_rv'){this.tx=rq.x;this.ty=bb(rq);this.path='reject_rv';}
      else{this.tx=bl(ex);this.ty=bcy(ex)+ex.h*0.3;this.path='approved';}
    }
    else if(this.phase===8){this.tx=bl(rq);this.ty=bcy(rq);this.path='reject_en';}
  };

  Particle.prototype.currentPos=function(){
    if(this.path&&PATHS[this.path]){return pathPoint(PATHS[this.path],this.t);}
    var e=this.t<0.5?2*this.t*this.t:-1+(4-2*this.t)*this.t;
    return{x:(1-e)*this.sx+e*this.tx,y:(1-e)*this.sy+e*this.ty};
  };

  Particle.prototype.update=function(){
    this.t+=this.speed;
    var pos=this.currentPos();
    this.history.push({x:pos.x,y:pos.y});
    if(this.history.length>12)this.history.shift();
    if(this.t>=1){
      this.t=0;this.sx=this.tx;this.sy=this.ty;this.path=null;this.phase++;
      if(this.phase===4&&this.fate==='reject_en'){
        this.col=P.pRed;this.phase=8;MODS[2]._hl=1;MODS[2]._pulse=1;
        rejectCount++;var re=document.getElementById('rejectCount');if(re)re.textContent=rejectCount;
      }
      else if(this.phase===7&&this.fate==='direct'){
        EXEC_BOX._hl=1;EXEC_BOX._pulse=1;
        wireCount++;var we=document.getElementById('wireCount');if(we)we.textContent=wireCount;
        return true;
      }
      else if(this.phase===8&&this.fate==='reject_rv'){
        this.col=P.pRed;REVIEW_BOX._hl=1;REJECT_BOX._hl=1;REJECT_BOX._pulse=1;
        rejectCount++;var rr=document.getElementById('rejectCount');if(rr)rr.textContent=rejectCount;
        return true;
      }
      else if(this.phase===8&&this.fate!=='reject_en'&&this.fate!=='reject_rv'){
        EXEC_BOX._hl=1;EXEC_BOX._pulse=1;
        wireCount++;var wa=document.getElementById('wireCount');if(wa)wa.textContent=wireCount;
        return true;
      }
      else if(this.phase===9){REJECT_BOX._hl=1;REJECT_BOX._pulse=1;return true;}
      else if(this.phase>9){return true;}
      if(this.phase>=1&&this.phase<=4){MODS[this.phase-1]._hl=1;MODS[this.phase-1]._pulse=1;}
      if(this.phase===6&&this.fate!=='direct'){REVIEW_BOX._hl=1;REVIEW_BOX._pulse=1;}
      this.setTarget();
    }
    return false;
  };

  Particle.prototype.draw=function(){
    var pos=this.currentPos();
    for(var i=0;i<this.history.length;i++){
      var h=this.history[i],frac=i/this.history.length;
      ctx.beginPath();ctx.arc(h.x,h.y,this.size*(0.12+frac*0.38),0,Math.PI*2);
      ctx.fillStyle=rgba(this.col,frac*0.20);ctx.fill();
    }
    var g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,this.size*4);
    g.addColorStop(0,rgba(this.col,0.40));g.addColorStop(1,rgba(this.col,0));
    ctx.beginPath();ctx.arc(pos.x,pos.y,this.size*4,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();ctx.arc(pos.x,pos.y,this.size,0,Math.PI*2);ctx.fillStyle=this.col;ctx.fill();
    ctx.beginPath();ctx.arc(pos.x,pos.y,this.size*0.45,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.75)';ctx.fill();
  };

  function tick(){
    ctx.clearRect(0,0,W,H);
    var all=MODS.concat([REJECT_BOX,REVIEW_BOX,EXEC_BOX]);
    all.forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.028);if(b._pulse)b._pulse=Math.max(0,b._pulse-0.038);});
    drawConnectors();
    drawPlatformBox();
    SRC.forEach(function(b){drawNode(b);});
    drawAddedSources();
    MODS.forEach(function(b){drawNode(b);});
    drawNode(REJECT_BOX);
    drawReviewNode();
    drawExecNode();
    drawLiveCounter();
    drawFlashes();
    drawConfigLog();
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    if(hoveredNode)drawTooltip(hoveredNode);
    requestAnimationFrame(tick);
  }

  function fireSource(id){
    var idx=SRC.findIndex(function(s){return s.id===id;});
    if(idx<0)return;
    for(var i=0;i<4;i++)(function(ii){setTimeout(function(){particles.push(new Particle(idx));},ii*180);})(i);
  }
  function fireAll(){['api','file','zday'].forEach(fireSource);}
  function scheduleAuto(){
    if(!autoMode)return;
    fireSource(['api','file','zday','api','file','api','zday'][Math.floor(Math.random()*7)]);
    autoTimer=setTimeout(scheduleAuto,900+Math.random()*700);
  }
  function toggleAuto(){
    autoMode=!autoMode;
    var btn=document.getElementById('autoBtn');
    if(btn){btn.textContent='Auto: '+(autoMode?'ON':'OFF');if(autoMode)btn.classList.add('active');else btn.classList.remove('active');}
    if(autoMode)scheduleAuto();else clearTimeout(autoTimer);
  }

  // ── DYNAMIC CONFIG ADDITIONS ──────────────────────────
  var ADDED_SOURCES = [];  // dynamically added source boxes
  var CONFIG_LOG = [];     // log of additions shown on canvas

  var SOURCE_TEMPLATES = [
    {id:'ftp',   label:'FTP feed',    sub:'new source', col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  pc:P.pGreen},
    {id:'api2',  label:'Partner API', sub:'new source', col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  pc:P.pGreen},
    {id:'swift2',label:'SWIFT feed',  sub:'new source', col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  pc:P.pGreen},
    {id:'mq',    label:'MQ stream',   sub:'new source', col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  pc:P.pGreen},
  ];
  var FUND_TEMPLATES   = ['Fund IV','Fund V','SPV-12','CLO-3','PE Fund VII','Credit Fund II'];
  var TEAM_TEMPLATES   = ['Credit Ops','IR Team','LP Ops','Risk Desk','Compliance'];

  var srcTplIdx=0, fundIdx=0, teamIdx=0;
  var flashItems = []; // {x,y,text,alpha,col}

  function addFlash(x, y, text, col) {
    flashItems.push({x:x, y:y, text:text, alpha:1.0, col:col, vy:-0.8*dpr});
  }

  function addSource() {
    var tpl = SOURCE_TEMPLATES[srcTplIdx % SOURCE_TEMPLATES.length]; srcTplIdx++;
    var sw = W*0.115, sh = H*0.095;
    var baseY = SRC[SRC.length-1] ? bb(SRC[SRC.length-1]) + H*0.022
                                   : H*0.30;
    // If off-screen, stack beside existing
    var newSrc = {
      id: tpl.id+'_'+srcTplIdx, label: tpl.label, sub: tpl.sub,
      x: W*0.085, y: Math.min(baseY, H*0.82),
      w: sw, h: sh,
      col: tpl.col, bg: tpl.bg, ring: tpl.ring, pc: tpl.pc,
      _hl: 1.5, _pulse: 1.5, _new: true
    };
    ADDED_SOURCES.push(newSrc);
    CONFIG_LOG.push({text:'+ source: '+tpl.label, col:P.teal, t:180});
    addFlash(newSrc.x, newSrc.y - H*0.04, '+ '+tpl.label+' added — no code change', P.teal);
    // Auto fire from it
    for(var i=0;i<3;i++)(function(ii, s){
      setTimeout(function(){ particles.push(new ParticleFrom(s)); }, ii*200+100);
    })(i, newSrc);
  }

  function addFund() {
    var name = FUND_TEMPLATES[fundIdx % FUND_TEMPLATES.length]; fundIdx++;
    var m = MODS[1]; // Configuration module
    m._hl=1.5; m._pulse=1.5;
    CONFIG_LOG.push({text:'+ fund: '+name+' enabled', col:P.purple, t:180});
    addFlash(m.x, bt(m)-H*0.04, '+ '+name+' — config only, no deployment', P.purple);
    // Fire a burst through the config module
    for(var i=0;i<4;i++)(function(ii){
      setTimeout(function(){ particles.push(new Particle(Math.floor(Math.random()*SRC.length))); }, ii*160+50);
    })(i);
  }

  function addTeam() {
    var name = TEAM_TEMPLATES[teamIdx % TEAM_TEMPLATES.length]; teamIdx++;
    var m = MODS[1]; // Configuration module
    m._hl=1.2; m._pulse=1.2;
    CONFIG_LOG.push({text:'+ team: '+name+' routed', col:P.purple, t:180});
    addFlash(m.x, bt(m)-H*0.04, '+ Team: '+name+' — routed via config', P.purple);
    for(var i=0;i<3;i++)(function(ii){
      setTimeout(function(){ particles.push(new Particle(Math.floor(Math.random()*SRC.length))); }, ii*180+50);
    })(i);
  }

  function resetConfig() {
    ADDED_SOURCES = [];
    CONFIG_LOG = [];
    flashItems = [];
    srcTplIdx=0; fundIdx=0; teamIdx=0;
    addFlash(W/2, H*0.5, '↺ Configuration reset', P.muted);
  }

  // Particle that starts from a dynamic source
  function ParticleFrom(src) {
    this.phase=0; this.t=0; this.speed=0.015+Math.random()*0.008;
    this.col=src.pc||P.pGreen; this.size=dpr*(2.0+Math.random()*0.8);
    this.sx=br(src); this.sy=bcy(src);
    this.tx=0; this.ty=0; this.history=[]; this.path=null;
    var r=Math.random();
    this.fate=r<0.12?'reject_en':r<0.22?'reject_rv':'direct';
    this.setTarget();
  }
  ParticleFrom.prototype.setTarget  = Particle.prototype.setTarget;
  ParticleFrom.prototype.currentPos = Particle.prototype.currentPos;
  ParticleFrom.prototype.update     = Particle.prototype.update;
  ParticleFrom.prototype.draw       = Particle.prototype.draw;

  function drawAddedSources() {
    ADDED_SOURCES.forEach(function(s) {
      if(s._hl) s._hl=Math.max(0,s._hl-0.025);
      if(s._pulse) s._pulse=Math.max(0,s._pulse-0.030);
      drawNode(s);
      // connector to normalize
      var m=MODS[0];
      ctx.beginPath(); ctx.moveTo(br(s),bcy(s));
      ctx.bezierCurveTo(br(s)+W*0.04,bcy(s),bl(m)-W*0.02,bcy(m),bl(m),bcy(m));
      ctx.strokeStyle=rgba(P.teal,0.22); ctx.lineWidth=dpr*0.9;
      ctx.setLineDash([4*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    });
  }

  function drawConfigLog() {
    var x=W*0.085+W*0.115/2, y=H-H*0.005;
    var fsize=fs(9.5);
    ctx.font='500 '+fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    CONFIG_LOG = CONFIG_LOG.filter(function(e){ e.t--; return e.t>0; });
    CONFIG_LOG.slice(-4).forEach(function(e,i) {
      var alpha=Math.min(1, e.t/30);
      var tw=ctx.measureText(e.text).width+10*dpr, th=13*dpr;
      var lx=x, ly=y-(i*(th+3*dpr));
      ctx.beginPath(); ctx.roundRect(lx-tw/2, ly-th, tw, th, 4*dpr);
      ctx.fillStyle=rgba(e.col,0.10*alpha); ctx.fill();
      ctx.fillStyle=rgba(e.col,0.9*alpha);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(e.text, lx, ly-th/2);
    });
  }

  function drawFlashes() {
    flashItems = flashItems.filter(function(f){ f.alpha-=0.012; f.y+=f.vy; return f.alpha>0; });
    flashItems.forEach(function(f) {
      var fsize=fs(11);
      ctx.font='600 '+fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
      var tw=ctx.measureText(f.text).width+16*dpr, th=18*dpr;
      ctx.beginPath(); ctx.roundRect(f.x-tw/2, f.y-th/2, tw, th, 6*dpr);
      ctx.fillStyle=rgba(f.col,0.12*f.alpha); ctx.fill();
      ctx.strokeStyle=rgba(f.col,0.3*f.alpha); ctx.lineWidth=dpr; ctx.stroke();
      ctx.fillStyle=rgba(f.col,f.alpha);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(f.text, f.x, f.y);
    });
  }

  // Wire up config buttons
  var bAddSrc=document.getElementById('btnAddSource');
  var bAddFund=document.getElementById('btnAddFund');
  var bAddTeam=document.getElementById('btnAddTeam');
  var bReset=document.getElementById('btnReset');
  if(bAddSrc)  bAddSrc.addEventListener('click',  addSource);
  if(bAddFund) bAddFund.addEventListener('click',  addFund);
  if(bAddTeam) bAddTeam.addEventListener('click',  addTeam);
  if(bReset)   bReset.addEventListener('click',    resetConfig);
  var bm = {btnApi:'api', btnFile:'file', btnZday:'zday'};
  Object.keys(bm).forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('click',function(){fireSource(bm[id]);});});
  var bAll=document.getElementById('btnAll'),bAuto=document.getElementById('autoBtn');
  if(bAll)bAll.addEventListener('click',fireAll);
  if(bAuto)bAuto.addEventListener('click',toggleAuto);

  canvas.addEventListener('mousemove',function(e){
    var rect=canvas.getBoundingClientRect();
    var mx=(e.clientX-rect.left)*dpr,my=(e.clientY-rect.top)*dpr;
    var all=SRC.concat(ADDED_SOURCES).concat(MODS).concat([REJECT_BOX,REVIEW_BOX,EXEC_BOX]);
    hoveredNode=null;
    for(var i=0;i<all.length;i++){if(inside(all[i],mx,my)){hoveredNode=all[i];break;}}
    canvas.style.cursor=hoveredNode?'help':'default';
  });
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});
  window.addEventListener('resize',function(){layout();});

  layout();tick();scheduleAuto();
});
