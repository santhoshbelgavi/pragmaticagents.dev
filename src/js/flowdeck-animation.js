document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('flowdeckCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [], hoveredNode = null, autoTimer = null;

  var P = {
    text:'#1A1714', muted:'#8A8480',
    orange:'#B85A08', orangeBg:'rgba(184,90,8,0.09)',  orangeRing:'rgba(184,90,8,0.22)',
    rust:  '#8B3A10', rustBg:  'rgba(139,58,16,0.08)', rustRing:  'rgba(139,58,16,0.22)',
    teal:  '#1A7A5E', tealBg:  'rgba(26,122,94,0.09)', tealRing:  'rgba(26,122,94,0.22)',
    indigo:'#4F46A0', indigoBg:'rgba(79,70,160,0.09)', indigoRing:'rgba(79,70,160,0.22)',
    slate: '#3D5A80', slateBg: 'rgba(61,90,128,0.09)', slateRing: 'rgba(61,90,128,0.22)',
    red:   '#9B2335', redBg:   'rgba(155,35,53,0.08)', redRing:   'rgba(155,35,53,0.22)',
    pOrange:'#F97316', pTeal:'#10B981', pIndigo:'#818CF8',
  };

  function rgba(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
  function bl(b){return b.x-b.w/2;} function br(b){return b.x+b.w/2;}
  function bt(b){return b.y;}        function bb(b){return b.y+b.h;}
  function bcy(b){return b.y+b.h/2;}
  function inside(b,mx,my){return mx>=bl(b)&&mx<=br(b)&&my>=bt(b)&&my<=bb(b);}
  function fs(base){return Math.max(base*dpr*0.62,base*0.9);}

  var W,H,FEEDS=[],CORE=[],TABS=[],PATHS={};

  function layout(){
    var cw=canvas.parentElement.clientWidth-8, ch=380;
    canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr); canvas.height=Math.floor(ch*dpr);
    W=canvas.width; H=canvas.height;
    var padT=H*0.06, availH=H-padT-H*0.06, gap=H*0.025;
    var c1=W*0.09, c2=W*0.36, c3=W*0.65, c4=W*0.89;

    // Data feeds
    var fh=(availH-gap*2)/3, fw=W*0.13;
    FEEDS=[
      {id:'theta',  label:'ThetaData', sub:'options flow', x:c1,y:padT,          w:fw,h:fh,col:P.orange,bg:P.orangeBg,ring:P.orangeRing,pc:P.pOrange,_hl:0,_pulse:0},
      {id:'qd',     label:'QuantData', sub:'vol surface',  x:c1,y:padT+fh+gap,   w:fw,h:fh,col:P.orange,bg:P.orangeBg,ring:P.orangeRing,pc:P.pOrange,_hl:0,_pulse:0},
      {id:'dxlink', label:'DXLink',    sub:'streaming',    x:c1,y:padT+fh*2+gap*2,w:fw,h:fh,col:P.orange,bg:P.orangeBg,ring:P.orangeRing,pc:P.pOrange,_hl:0,_pulse:0},
    ];

    // Core modules
    var mh=(availH-gap*2)/3, mw=W*0.21;
    CORE=[
      {id:'classifier',label:'Trade classifier',  sub:'sweep · block · split · repeat', x:c2,y:padT,          w:mw,h:mh,col:P.rust,  bg:P.rustBg,  ring:P.rustRing,  pc:P.pOrange,_hl:0,_pulse:0},
      {id:'zscore',    label:'Z-score composite', sub:'normalized signal strength',      x:c2,y:padT+mh+gap,   w:mw,h:mh,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,pc:P.pIndigo,_hl:0,_pulse:0},
      {id:'dsl',       label:'Filter DSL',        sub:'JSON config · no code change',   x:c2,y:padT+mh*2+gap*2,w:mw,h:mh,col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  pc:P.pTeal,  _hl:0,_pulse:0},
    ];

    // Dashboard tabs (right)
    var th=(availH-gap*4)/5, tw=W*0.18;
    TABS=[
      {id:'live',    label:'Live flow',    sub:'real-time prints',      x:c3,y:padT,            w:tw,h:th,col:P.orange,bg:P.orangeBg,ring:P.orangeRing,_hl:0,_pulse:0},
      {id:'comp',    label:'Composite',    sub:'z-score by ticker',     x:c3,y:padT+th+gap,     w:tw,h:th,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,_hl:0,_pulse:0},
      {id:'unusual', label:'Unusual',      sub:'flagged activity',      x:c3,y:padT+th*2+gap*2, w:tw,h:th,col:P.red,   bg:P.redBg,   ring:P.redRing,   _hl:0,_pulse:0},
      {id:'history', label:'Replay',       sub:'WebSocket replay',      x:c3,y:padT+th*3+gap*3, w:tw,h:th,col:P.slate, bg:P.slateBg, ring:P.slateRing, _hl:0,_pulse:0},
      {id:'scanner', label:'Scanner DSL',  sub:'configure filters',     x:c3,y:padT+th*4+gap*4, w:tw,h:th,col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  _hl:0,_pulse:0},
    ];

    // APEX integration node
    var ax={id:'apex',label:'APEX',sub:'signal consumer',x:c4,y:padT+availH*0.2,w:W*0.11,h:availH*0.6,col:P.slate,bg:P.slateBg,ring:P.slateRing,_hl:0,_pulse:0};
    TABS.push(ax);

    buildPaths();
  }

  function buildPaths(){
    FEEDS.forEach(function(f){
      PATHS['f_'+f.id]={sx:br(f),sy:bcy(f),cx1:br(f)+W*0.05,cy1:bcy(f),cx2:bl(CORE[0])-W*0.03,cy2:bcy(CORE[0]),tx:bl(CORE[0]),ty:bcy(CORE[0])};
    });
    PATHS.c01={sx:CORE[0].x,sy:bb(CORE[0]),cx1:CORE[0].x,cy1:bb(CORE[0])+H*0.03,cx2:CORE[1].x,cy2:bt(CORE[1])-H*0.03,tx:CORE[1].x,ty:bt(CORE[1])};
    PATHS.c12={sx:CORE[1].x,sy:bb(CORE[1]),cx1:CORE[1].x,cy1:bb(CORE[1])+H*0.03,cx2:CORE[2].x,cy2:bt(CORE[2])-H*0.03,tx:CORE[2].x,ty:bt(CORE[2])};
    TABS.slice(0,5).forEach(function(t,i){
      var src=CORE[Math.min(i,2)];
      PATHS['t_'+t.id]={sx:br(src),sy:bcy(src),cx1:br(src)+W*0.04,cy1:bcy(src),cx2:bl(t)-W*0.02,cy2:bcy(t),tx:bl(t),ty:bcy(t)};
    });
    var apex=TABS[5];
    PATHS.apex={sx:br(TABS[1]),sy:bcy(TABS[1]),cx1:br(TABS[1])+W*0.03,cy1:bcy(TABS[1]),cx2:bl(apex)-W*0.02,cy2:bcy(apex),tx:bl(apex),ty:bcy(apex)};
  }

  function pathPoint(p,t){
    var e=t<0.5?2*t*t:-1+(4-2*t)*t;
    return{x:(1-e)*(1-e)*(1-e)*p.sx+3*(1-e)*(1-e)*e*p.cx1+3*(1-e)*e*e*p.cx2+e*e*e*p.tx,
           y:(1-e)*(1-e)*(1-e)*p.sy+3*(1-e)*(1-e)*e*p.cy1+3*(1-e)*e*e*p.cy2+e*e*e*p.ty};
  }

  function shadow(s,c){ctx.shadowBlur=s;ctx.shadowColor=c;}
  function noShadow(){ctx.shadowBlur=0;ctx.shadowColor='transparent';}

  function drawNode(b){
    var hl=b._hl||0,r=8*dpr,x=bl(b),y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05)shadow(18*dpr*hl,rgba(b.col,0.3*hl));
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=b.bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65):(hov?rgba(b.col,0.55):rgba(b.col,0.25));
    ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);ctx.stroke();noShadow();
    if(b._pulse>0){ctx.beginPath();ctx.roundRect(x-b._pulse*9*dpr,y-b._pulse*9*dpr,b.w+b._pulse*18*dpr,b.h+b._pulse*18*dpr,r+b._pulse*9*dpr);ctx.strokeStyle=rgba(b.col,b._pulse*0.3);ctx.lineWidth=dpr*1.5;ctx.stroke();}
    ctx.fillStyle=b.col;ctx.font='700 '+fs(12)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.label,b.x,b.y+b.h*0.37);
    ctx.fillStyle=P.muted;ctx.font='400 '+fs(9.5)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.fillText(b.sub,b.x,b.y+b.h*0.68);
  }

  function drawGroupBox(nodes,label,col){
    var p=12*dpr,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    nodes.forEach(function(n){minX=Math.min(minX,bl(n));minY=Math.min(minY,bt(n));maxX=Math.max(maxX,br(n));maxY=Math.max(maxY,bb(n));});
    ctx.beginPath();ctx.roundRect(minX-p,minY-p,maxX-minX+p*2,maxY-minY+p*2,12*dpr);
    ctx.fillStyle=rgba(col,0.025);ctx.fill();ctx.strokeStyle=rgba(col,0.13);ctx.lineWidth=dpr;ctx.setLineDash([5*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=rgba(col,0.5);ctx.font='500 '+fs(8.5)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(label,(minX+maxX)/2,minY-p+4*dpr);
  }

  var TIPS={
    theta:'ThetaData Options Pro — real-time options trade prints, full OPRA feed. Primary source for live flow classification.',
    qd:'QuantData — volatility surface data, 60-second interval sampling written to DuckDB. Used for IV rank and composite scoring.',
    dxlink:'DXLink — streaming market data, used as fallback when primary feeds are delayed or unavailable.',
    classifier:'The Rust flowengine core. Every options print is classified: sweep (aggressive cross-exchange), block (large single print), split (same order across exchanges), or repeat (same strike/expiry pattern). 27 tests, compile-verified.',
    zscore:'Composite signal strength is z-score normalized across tickers and expirations. Prevents a high-volume ticker from dominating the unusual activity feed.',
    dsl:'Filters are JSON configuration, not code. Add a new screen — e.g., "sweeps over $500K notional in tech names with IV rank > 60" — save the JSON, reload. No deployment.',
    live:'Real-time feed of classified options prints. Updated on each WebSocket message.',
    comp:'Z-score composite view sorted by signal strength. The tickers with the most unusual activity relative to their own baseline surface first.',
    unusual:'Flagged prints that exceed configured thresholds. The primary actionable view.',
    history:'WebSocket replay engine. Replay any stored session to backtest filter logic against real historical flow.',
    scanner:'The DSL editor. Write, test, and save filter configurations without touching code.',
    apex:'FlowDeck feeds confirmed unusual flow signals directly into APEX as a secondary confirmation layer for trade entry decisions.',
  };

  function drawTooltip(b){
    var text=TIPS[b.id];if(!text)return;
    var maxW=Math.min(W*0.28,210*dpr),fsize=fs(10);
    ctx.font=fsize+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';
    var words=text.split(' '),lines=[],cur='';
    words.forEach(function(w){var test=cur?cur+' '+w:w;if(ctx.measureText(test).width>maxW-14*dpr){lines.push(cur);cur=w;}else cur=test;});if(cur)lines.push(cur);
    var lh=fsize*1.5,pad=10*dpr,tw=maxW,th=lines.length*lh+pad*2;
    var tx=b.x-tw/2,ty=bb(b)+8*dpr;
    if(tx<4*dpr)tx=4*dpr;if(tx+tw>W-4*dpr)tx=W-tw-4*dpr;if(ty+th>H-4*dpr)ty=bt(b)-th-8*dpr;
    ctx.shadowBlur=12*dpr;ctx.shadowColor='rgba(0,0,0,0.10)';
    ctx.beginPath();ctx.roundRect(tx,ty,tw,th,7*dpr);ctx.fillStyle='#FFFDF9';ctx.fill();noShadow();
    ctx.strokeStyle=rgba(b.col,0.28);ctx.lineWidth=dpr;ctx.stroke();
    ctx.fillStyle=P.text;ctx.textAlign='left';ctx.textBaseline='top';
    lines.forEach(function(l,i){ctx.fillText(l,tx+pad,ty+pad+i*lh);});
  }

  function drawConnectors(){
    ctx.setLineDash([4*dpr,4*dpr]);ctx.lineWidth=dpr*0.8;
    FEEDS.forEach(function(f){var p=PATHS['f_'+f.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(f.col,0.18);ctx.stroke();});
    [PATHS.c01,PATHS.c12].forEach(function(p){ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(P.muted,0.20);ctx.stroke();});
    TABS.slice(0,5).forEach(function(t){var p=PATHS['t_'+t.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(t.col,0.18);ctx.stroke();});
    var ap=PATHS.apex;ctx.beginPath();ctx.moveTo(ap.sx,ap.sy);ctx.bezierCurveTo(ap.cx1,ap.cy1,ap.cx2,ap.cy2,ap.tx,ap.ty);ctx.strokeStyle=rgba(P.slate,0.20);ctx.stroke();
    ctx.setLineDash([]);
  }

  function Particle(feedIdx){
    var f=FEEDS[feedIdx];this.fid=f.id;this.phase=0;this.t=0;this.speed=0.017+Math.random()*0.009;
    this.col=f.pc;this.size=dpr*(1.8+Math.random()*0.7);this.sx=br(f);this.sy=bcy(f);this.tx=0;this.ty=0;this.history=[];this.pathKey=null;
    this.destCore=Math.floor(Math.random()*3);this.destTab=Math.floor(Math.random()*5);this.setTarget();
  }
  Particle.prototype.setTarget=function(){
    if(this.phase===0){var p=PATHS['f_'+this.fid];this.tx=p.tx;this.ty=p.ty;this.pathKey='f_'+this.fid;}
    else if(this.phase===1){this.tx=CORE[0].x;this.ty=bcy(CORE[0]);this.pathKey=null;}
    else if(this.phase===2){this.tx=CORE[1].x;this.ty=bcy(CORE[1]);this.pathKey='c01';}
    else if(this.phase===3){var t=TABS[this.destTab];this.tx=bl(t);this.ty=bcy(t);this.pathKey='t_'+t.id;}
  };
  Particle.prototype.currentPos=function(){
    if(this.pathKey&&PATHS[this.pathKey])return pathPoint(PATHS[this.pathKey],this.t);
    var e=this.t<0.5?2*this.t*this.t:-1+(4-2*this.t)*this.t;return{x:(1-e)*this.sx+e*this.tx,y:(1-e)*this.sy+e*this.ty};
  };
  Particle.prototype.update=function(){
    this.t+=this.speed;var pos=this.currentPos();this.history.push({x:pos.x,y:pos.y});if(this.history.length>10)this.history.shift();
    if(this.t>=1){this.t=0;this.sx=this.tx;this.sy=this.ty;this.pathKey=null;this.phase++;
      if(this.phase===2){CORE[0]._hl=1;CORE[0]._pulse=1;}
      if(this.phase===3){CORE[1]._hl=0.8;}
      if(this.phase===4){TABS[this.destTab]._hl=1;TABS[this.destTab]._pulse=1;return true;}
      if(this.phase>4)return true;
      this.setTarget();
    }
    return false;
  };
  Particle.prototype.draw=function(){
    var pos=this.currentPos();
    for(var i=0;i<this.history.length;i++){var h=this.history[i],frac=i/this.history.length;ctx.beginPath();ctx.arc(h.x,h.y,this.size*(0.12+frac*0.35),0,Math.PI*2);ctx.fillStyle=rgba(this.col,frac*0.18);ctx.fill();}
    var g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,this.size*3.5);g.addColorStop(0,rgba(this.col,0.38));g.addColorStop(1,rgba(this.col,0));
    ctx.beginPath();ctx.arc(pos.x,pos.y,this.size*3.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();ctx.arc(pos.x,pos.y,this.size,0,Math.PI*2);ctx.fillStyle=this.col;ctx.fill();
    ctx.beginPath();ctx.arc(pos.x,pos.y,this.size*0.4,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.75)';ctx.fill();
  };

  function fire(idx){for(var i=0;i<2;i++)(function(ii){setTimeout(function(){particles.push(new Particle(idx));},ii*200);})(i);}
  function scheduleAuto(){fire(Math.floor(Math.random()*FEEDS.length));autoTimer=setTimeout(scheduleAuto,850+Math.random()*650);}

  function tick(){
    ctx.clearRect(0,0,W,H);
    var all=FEEDS.concat(CORE).concat(TABS);all.forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.025);if(b._pulse)b._pulse=Math.max(0,b._pulse-0.035);});
    drawConnectors();
    drawGroupBox(FEEDS,'Licensed feeds',P.orange);drawGroupBox(CORE,'flowengine (Rust)',P.rust);drawGroupBox(TABS.slice(0,5),'7-tab SPA',P.indigo);
    all.forEach(drawNode);
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    if(hoveredNode)drawTooltip(hoveredNode);requestAnimationFrame(tick);
  }

  canvas.addEventListener('mousemove',function(e){
    var rect=canvas.getBoundingClientRect(),mx=(e.clientX-rect.left)*dpr,my=(e.clientY-rect.top)*dpr;
    var all=FEEDS.concat(CORE).concat(TABS);hoveredNode=null;for(var i=0;i<all.length;i++){if(inside(all[i],mx,my)){hoveredNode=all[i];break;}}canvas.style.cursor=hoveredNode?'help':'default';
  });
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});
  window.addEventListener('resize',function(){layout();});
  layout();tick();scheduleAuto();
});
