document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('apexCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [], hoveredNode = null, autoTimer = null;

  var P = {
    text:'#1A1714', muted:'#8A8480',
    blue:  '#1A5FAA', blueBg:  'rgba(26,95,170,0.09)',   blueRing:  'rgba(26,95,170,0.22)',
    teal:  '#1A7A5E', tealBg:  'rgba(26,122,94,0.09)',   tealRing:  'rgba(26,122,94,0.22)',
    indigo:'#4F46A0', indigoBg:'rgba(79,70,160,0.09)',   indigoRing:'rgba(79,70,160,0.22)',
    amber: '#B86A00', amberBg: 'rgba(184,106,0,0.09)',   amberRing: 'rgba(184,106,0,0.22)',
    red:   '#9B2335', redBg:   'rgba(155,35,53,0.08)',   redRing:   'rgba(155,35,53,0.22)',
    green: '#1A6B3A', greenBg: 'rgba(26,107,58,0.09)',   greenRing: 'rgba(26,107,58,0.22)',
    slate: '#3D5A80', slateBg: 'rgba(61,90,128,0.09)',   slateRing: 'rgba(61,90,128,0.22)',
    pBlue:'#3B82F6', pTeal:'#10B981', pAmber:'#F59E0B', pRed:'#EF4444',
  };

  function rgba(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
  function bl(b){return b.x-b.w/2;} function br(b){return b.x+b.w/2;}
  function bt(b){return b.y;}        function bb(b){return b.y+b.h;}
  function bcy(b){return b.y+b.h/2;}
  function inside(b,mx,my){return mx>=bl(b)&&mx<=br(b)&&my>=bt(b)&&my<=bb(b);}
  function fs(base){return Math.max(base*dpr*0.62,base*0.9);}

  var W,H,DATA=[],GATES=[],EXEC,REJECTED,PATHS={};

  function layout(){
    var cw=canvas.parentElement.clientWidth-8,ch=420;
    canvas.style.width=cw+'px';canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr);canvas.height=Math.floor(ch*dpr);
    W=canvas.width;H=canvas.height;
    var padT=H*0.06,availH=H-padT-H*0.06,gap=H*0.022;
    var c1=W*0.08,c2=W*0.25,c3=W*0.43,c4=W*0.61,c5=W*0.79,c6=W*0.92;

    // Data inputs
    var dh=(availH-gap*2)/3,dw=W*0.12;
    DATA=[
      {id:'ias',    label:'SanthoshIAS', sub:'market data',    x:c1,y:padT,           w:dw,h:dh,col:P.blue, bg:P.blueBg, ring:P.blueRing, pc:P.pBlue, _hl:0,_pulse:0},
      {id:'flow',   label:'FlowDeck',   sub:'unusual flow',    x:c1,y:padT+dh+gap,    w:dw,h:dh,col:P.teal, bg:P.tealBg, ring:P.tealRing, pc:P.pTeal, _hl:0,_pulse:0},
      {id:'bayes',  label:'Bayesian',   sub:'expectancy prior',x:c1,y:padT+dh*2+gap*2,w:dw,h:dh,col:P.amber,bg:P.amberBg,ring:P.amberRing,pc:P.pAmber,_hl:0,_pulse:0},
    ];

    // Five safety gates
    var gh=(availH-gap*4)/5,gw=W*0.13;
    GATES=[
      {id:'ves',    label:'VES scanner',     sub:'vol expansion · z-score',   x:c2,y:padT,              w:gw,h:gh,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,pc:P.pBlue, _hl:0,_pulse:0},
      {id:'strike', label:'Strike select',   sub:'EM units · regime presets', x:c2,y:padT+gh+gap,       w:gw,h:gh,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,pc:P.pBlue, _hl:0,_pulse:0},
      {id:'statemachine',label:'State machine',sub:'per-symbol · IDLE→EXIT',  x:c2,y:padT+gh*2+gap*2,  w:gw,h:gh,col:P.amber, bg:P.amberBg, ring:P.amberRing, pc:P.pAmber,_hl:0,_pulse:0},
      {id:'closeintent', label:'Close-intent gate',sub:'prevents naked short',x:c2,y:padT+gh*3+gap*3,  w:gw,h:gh,col:P.red,   bg:P.redBg,   ring:P.redRing,   pc:P.pRed,  _hl:0,_pulse:0},
      {id:'http422', label:'HTTP 422 guard', sub:'order rejection layer',     x:c2,y:padT+gh*4+gap*4,  w:gw,h:gh,col:P.red,   bg:P.redBg,   ring:P.redRing,   pc:P.pRed,  _hl:0,_pulse:0},
    ];

    // Exit architecture
    var ew=W*0.13,eh=(availH-gap*3)/4;
    var EXIT_NODES=[
      {id:'breakevengate',label:'Break-even mover',sub:'locks in basis',       x:c3,y:padT,             w:ew,h:eh,col:P.green,bg:P.greenBg,ring:P.greenRing,_hl:0,_pulse:0},
      {id:'regimeexit',   label:'Regime-change exit',sub:'closes on shift',   x:c3,y:padT+eh+gap,      w:ew,h:eh,col:P.green,bg:P.greenBg,ring:P.greenRing,_hl:0,_pulse:0},
      {id:'theta',        label:'Theta manager',    sub:'accelerates near exp',x:c3,y:padT+eh*2+gap*2,  w:ew,h:eh,col:P.green,bg:P.greenBg,ring:P.greenRing,_hl:0,_pulse:0},
      {id:'tranche',      label:'Tranche policy',   sub:'partial exits',       x:c3,y:padT+eh*3+gap*3,  w:ew,h:eh,col:P.green,bg:P.greenBg,ring:P.greenRing,_hl:0,_pulse:0},
    ];
    GATES=GATES.concat(EXIT_NODES);

    // Execution + rejected
    EXEC={id:'exec',label:'Order submitted',sub:'Alpaca · IBKR · Tastyworks',x:c5,y:padT+availH*0.15,w:W*0.13,h:availH*0.35,col:P.teal,bg:P.tealBg,ring:P.tealRing,_hl:0,_pulse:0};
    REJECTED={id:'rejected',label:'Rejected',sub:'422 · gate blocked',x:c5,y:padT+availH*0.60,w:W*0.13,h:availH*0.28,col:P.red,bg:P.redBg,ring:P.redRing,_hl:0,_pulse:0};

    buildPaths();
  }

  function buildPaths(){
    DATA.forEach(function(d){PATHS['d_'+d.id]={sx:br(d),sy:bcy(d),cx1:br(d)+W*0.04,cy1:bcy(d),cx2:bl(GATES[0])-W*0.02,cy2:bcy(GATES[0]),tx:bl(GATES[0]),ty:bcy(GATES[0])};});
    for(var i=0;i<4;i++){PATHS['g'+i+'_'+i+'1']={sx:GATES[i].x,sy:bb(GATES[i]),cx1:GATES[i].x,cy1:bb(GATES[i])+H*0.02,cx2:GATES[i+1].x,cy2:bt(GATES[i+1])-H*0.02,tx:GATES[i+1].x,ty:bt(GATES[i+1])};}
    PATHS.g_exec={sx:br(GATES[3]),sy:bcy(GATES[3]),cx1:br(GATES[3])+W*0.05,cy1:bcy(GATES[3]),cx2:bl(EXEC)-W*0.02,cy2:bcy(EXEC),tx:bl(EXEC),ty:bcy(EXEC)};
    PATHS.g_rej={sx:br(GATES[4]),sy:bcy(GATES[4]),cx1:br(GATES[4])+W*0.05,cy1:bcy(GATES[4]),cx2:bl(REJECTED)-W*0.02,cy2:bcy(REJECTED),tx:bl(REJECTED),ty:bcy(REJECTED)};
  }

  function pathPoint(p,t){var e=t<0.5?2*t*t:-1+(4-2*t)*t;return{x:(1-e)*(1-e)*(1-e)*p.sx+3*(1-e)*(1-e)*e*p.cx1+3*(1-e)*e*e*p.cx2+e*e*e*p.tx,y:(1-e)*(1-e)*(1-e)*p.sy+3*(1-e)*(1-e)*e*p.cy1+3*(1-e)*e*e*p.cy2+e*e*e*p.ty};}
  function shadow(s,c){ctx.shadowBlur=s;ctx.shadowColor=c;}function noShadow(){ctx.shadowBlur=0;ctx.shadowColor='transparent';}

  function drawNode(b){
    var hl=b._hl||0,r=8*dpr,x=bl(b),y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05)shadow(18*dpr*hl,rgba(b.col,0.3*hl));
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);ctx.fillStyle=b.bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65):(hov?rgba(b.col,0.55):rgba(b.col,0.25));ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);ctx.stroke();noShadow();
    if(b._pulse>0){ctx.beginPath();ctx.roundRect(x-b._pulse*9*dpr,y-b._pulse*9*dpr,b.w+b._pulse*18*dpr,b.h+b._pulse*18*dpr,r+b._pulse*9*dpr);ctx.strokeStyle=rgba(b.col,b._pulse*0.3);ctx.lineWidth=dpr*1.5;ctx.stroke();}
    ctx.fillStyle=b.col;ctx.font='700 '+fs(11.5)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.label,b.x,b.y+b.h*0.37);
    ctx.fillStyle=P.muted;ctx.font='400 '+fs(9)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.fillText(b.sub,b.x,b.y+b.h*0.68);
  }

  function drawConnectors(){
    ctx.setLineDash([4*dpr,4*dpr]);ctx.lineWidth=dpr*0.8;
    DATA.forEach(function(d){var p=PATHS['d_'+d.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(d.col,0.18);ctx.stroke();});
    for(var i=0;i<4;i++){var p=PATHS['g'+i+'_'+i+'1'];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(P.muted,0.18);ctx.stroke();}
    var ge=PATHS.g_exec;ctx.beginPath();ctx.moveTo(ge.sx,ge.sy);ctx.bezierCurveTo(ge.cx1,ge.cy1,ge.cx2,ge.cy2,ge.tx,ge.ty);ctx.strokeStyle=rgba(P.teal,0.25);ctx.stroke();
    var gr=PATHS.g_rej;ctx.beginPath();ctx.moveTo(gr.sx,gr.sy);ctx.bezierCurveTo(gr.cx1,gr.cy1,gr.cx2,gr.cy2,gr.tx,gr.ty);ctx.strokeStyle=rgba(P.red,0.25);ctx.stroke();
    ctx.setLineDash([]);
  }

  var TIPS={
    ias:'SanthoshIAS provides real-time market data — options chains, equity prices, vol surface — to the signal pipeline.',
    flow:'FlowDeck feeds confirmed unusual flow signals as secondary confirmation. An options signal + unusual flow = higher conviction.',
    bayes:'The Bayesian expectancy engine maintains prior beliefs about strategy performance per regime. Informs position sizing via a fractional Kelly formula.',
    ves:'Volatility Expansion Scanner. Cross-sectional z-score composite — which tickers are experiencing unusual vol expansion relative to their own history. GEX oriented as signed signal. K-of-N conviction gate.',
    strike:'Strike Selection V2. Uses Expected Move units from ATM straddle mids, not static percentages. Composite-scored candidates with four regime presets: PINNED, TRANSITIONAL, AMPLIFIED, DEFENSIVE.',
    statemachine:'Per-symbol state machines: IDLE → SCANNING → ENTERED → MANAGING → EXITING. No order can be submitted unless the state machine is in a valid state. The architectural fix for the naked-short bug.',
    closeintent:'Close-intent gate validates position state before any order submission. The v10 naked-short bug — 24 illegal orders, ~$21K paper losses — is prevented here.',
    http422:'HTTP 422 rejection at the order endpoint. Any order that would create an invalid position is rejected at the API layer, independent of the state machine.',
    breakevengate:'Once a position reaches a profit threshold, the break-even mover shifts the stop to basis. Locks in a no-loss floor.',
    regimeexit:'When the market character classifier signals a regime shift, open positions in the old regime are closed. Prevents trending-regime trades from dying in mean-reversion.',
    theta:'As expiration approaches and theta burn accelerates, the theta manager tightens exit criteria and may force closure. Prevents holding through the last-day decay cliff.',
    tranche:'Allows partial exits at different profit targets. Take some off at 50%, let the rest run to 100%. Reduces the all-or-nothing binary that cost the most in v10.',
    exec:'Orders submitted to Alpaca (equities/ETFs), IBKR (live managed), or Tastyworks (options).',
    rejected:'Orders blocked by the close-intent gate or HTTP 422 layer. Logged for attribution analysis.',
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
    ctx.shadowBlur=12*dpr;ctx.shadowColor='rgba(0,0,0,0.10)';ctx.beginPath();ctx.roundRect(tx,ty,tw,th,7*dpr);ctx.fillStyle='#FFFDF9';ctx.fill();noShadow();
    ctx.strokeStyle=rgba(b.col,0.28);ctx.lineWidth=dpr;ctx.stroke();
    ctx.fillStyle=P.text;ctx.textAlign='left';ctx.textBaseline='top';lines.forEach(function(l,i){ctx.fillText(l,tx+pad,ty+pad+i*lh);});
  }

  function Particle(dataIdx){
    var d=DATA[dataIdx];this.did=d.id;this.col=d.pc;this.phase=0;this.t=0;this.speed=0.015+Math.random()*0.008;
    this.size=dpr*(1.8+Math.random()*0.7);this.sx=br(d);this.sy=bcy(d);this.tx=0;this.ty=0;this.history=[];this.pathKey=null;
    this.fate=Math.random()<0.15?'reject':'pass';this.gateIdx=0;this.setTarget();
  }
  Particle.prototype.setTarget=function(){
    if(this.phase===0){var p=PATHS['d_'+this.did];this.tx=p.tx;this.ty=p.ty;this.pathKey='d_'+this.did;}
    else if(this.phase>=1&&this.phase<=4&&this.gateIdx<4){var g=GATES[this.gateIdx];this.tx=g.x;this.ty=bcy(g);this.pathKey='g'+(this.gateIdx-1<0?0:this.gateIdx-1)+'_'+this.gateIdx;}
    else if(this.phase===5){
      if(this.fate==='reject'){this.tx=bl(REJECTED);this.ty=bcy(REJECTED);this.pathKey='g_rej';}
      else{this.tx=bl(EXEC);this.ty=bcy(EXEC);this.pathKey='g_exec';}
    }
  };
  Particle.prototype.currentPos=function(){
    if(this.pathKey&&PATHS[this.pathKey])return pathPoint(PATHS[this.pathKey],this.t);
    var e=this.t<0.5?2*this.t*this.t:-1+(4-2*this.t)*this.t;return{x:(1-e)*this.sx+e*this.tx,y:(1-e)*this.sy+e*this.ty};
  };
  Particle.prototype.update=function(){
    this.t+=this.speed;var pos=this.currentPos();this.history.push({x:pos.x,y:pos.y});if(this.history.length>10)this.history.shift();
    if(this.t>=1){this.t=0;this.sx=this.tx;this.sy=this.ty;this.pathKey=null;this.phase++;
      if(this.phase>=1&&this.phase<=4){this.gateIdx=this.phase-1;GATES[this.gateIdx]._hl=1;GATES[this.gateIdx]._pulse=1;}
      if(this.phase===5){if(this.fate==='reject'){this.col=P.pRed;}};
      if(this.phase===6){
        if(this.fate==='reject'){REJECTED._hl=1;REJECTED._pulse=1;}else{EXEC._hl=1;EXEC._pulse=1;}
        return true;
      }
      if(this.phase>6)return true;
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
  function scheduleAuto(){fire(Math.floor(Math.random()*DATA.length));autoTimer=setTimeout(scheduleAuto,800+Math.random()*700);}

  function tick(){
    ctx.clearRect(0,0,W,H);
    var all=DATA.concat(GATES).concat([EXEC,REJECTED]);
    all.forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.025);if(b._pulse)b._pulse=Math.max(0,b._pulse-0.035);});
    drawConnectors();all.forEach(drawNode);
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    if(hoveredNode)drawTooltip(hoveredNode);requestAnimationFrame(tick);
  }

  canvas.addEventListener('mousemove',function(e){
    var rect=canvas.getBoundingClientRect(),mx=(e.clientX-rect.left)*dpr,my=(e.clientY-rect.top)*dpr;
    var all=DATA.concat(GATES).concat([EXEC,REJECTED]);hoveredNode=null;
    for(var i=0;i<all.length;i++){if(inside(all[i],mx,my)){hoveredNode=all[i];break;}}canvas.style.cursor=hoveredNode?'help':'default';
  });
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});
  window.addEventListener('resize',function(){layout();});
  layout();tick();scheduleAuto();
});
