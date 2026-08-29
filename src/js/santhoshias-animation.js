document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('santhoshiasCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [], hoveredNode = null, autoTimer = null;

  var P = {
    text:'#1A1714', muted:'#8A8480',
    rust:  '#8B3A10', rustBg:  'rgba(139,58,16,0.09)', rustRing:  'rgba(139,58,16,0.22)',
    teal:  '#1A7A5E', tealBg:  'rgba(26,122,94,0.09)', tealRing:  'rgba(26,122,94,0.22)',
    indigo:'#4F46A0', indigoBg:'rgba(79,70,160,0.09)', indigoRing:'rgba(79,70,160,0.22)',
    amber: '#B86A00', amberBg: 'rgba(184,106,0,0.09)', amberRing: 'rgba(184,106,0,0.22)',
    slate: '#3D5A80', slateBg: 'rgba(61,90,128,0.09)', slateRing: 'rgba(61,90,128,0.22)',
    blue:  '#1A5FAA', blueBg:  'rgba(26,95,170,0.09)', blueRing:  'rgba(26,95,170,0.22)',
    red:   '#9B2335', redBg:   'rgba(155,35,53,0.08)', redRing:   'rgba(155,35,53,0.22)',
    pRust:'#F97316', pTeal:'#10B981', pBlue:'#3B82F6', pIndigo:'#818CF8',
  };

  function rgba(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
  function bl(b){return b.x-b.w/2;} function br(b){return b.x+b.w/2;}
  function bt(b){return b.y;}        function bb(b){return b.y+b.h;}
  function bcy(b){return b.y+b.h/2;}
  function inside(b,mx,my){return mx>=bl(b)&&mx<=br(b)&&my>=bt(b)&&my<=bb(b);}
  function fs(base){return Math.max(base*dpr*0.62,base*0.9);}

  var W,H,CONSUMERS=[],RESOLVER,PROVIDERS=[],DUCKDB,REDIS,PATHS={};

  function layout(){
    var cw=canvas.parentElement.clientWidth-8,ch=380;
    canvas.style.width=cw+'px';canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr);canvas.height=Math.floor(ch*dpr);
    W=canvas.width;H=canvas.height;
    var padT=H*0.06,availH=H-padT-H*0.06,gap=H*0.022;
    var c1=W*0.08,c2=W*0.30,c3=W*0.58,c4=W*0.80,c5=W*0.93;

    // Consumers
    var ch2=(availH-gap*2)/3,cw2=W*0.13;
    CONSUMERS=[
      {id:'moneta',  label:'Moneta',   sub:'finance platform',x:c1,y:padT,           w:cw2,h:ch2,col:P.teal,  bg:P.tealBg,  ring:P.tealRing,  pc:P.pTeal,  _hl:0,_pulse:0},
      {id:'flowdeck',label:'FlowDeck', sub:'flow analytics',  x:c1,y:padT+ch2+gap,   w:cw2,h:ch2,col:P.rust,  bg:P.rustBg,  ring:P.rustRing,  pc:P.pRust,  _hl:0,_pulse:0},
      {id:'apex',    label:'APEX',     sub:'trading platform', x:c1,y:padT+ch2*2+gap*2,w:cw2,h:ch2,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,pc:P.pIndigo,_hl:0,_pulse:0},
    ];

    // DataResolver gateway
    RESOLVER={id:'resolver',label:'DataResolver',sub:'priority-chain routing',x:c2,y:padT+availH*0.25,w:W*0.16,h:availH*0.5,col:P.amber,bg:P.amberBg,ring:P.amberRing,_hl:0,_pulse:0};

    // Providers (priority order top to bottom)
    var ph=(availH-gap*5)/6,pw=W*0.14;
    PROVIDERS=[
      {id:'theta',  label:'ThetaData', sub:'P1 · options',    x:c3,y:padT,             w:pw,h:ph,col:P.blue, bg:P.blueBg, ring:P.blueRing, pc:P.pBlue, _hl:0,_pulse:0,active:true},
      {id:'qd',     label:'QuantData', sub:'P2 · vol/flow',   x:c3,y:padT+ph+gap,      w:pw,h:ph,col:P.blue, bg:P.blueBg, ring:P.blueRing, pc:P.pBlue, _hl:0,_pulse:0,active:true},
      {id:'dxlink', label:'DXLink',    sub:'P3 · streaming',  x:c3,y:padT+ph*2+gap*2,  w:pw,h:ph,col:P.slate,bg:P.slateBg,ring:P.slateRing,pc:P.pBlue, _hl:0,_pulse:0,active:true},
      {id:'alpaca', label:'Alpaca',    sub:'P4 · equity',     x:c3,y:padT+ph*3+gap*3,  w:pw,h:ph,col:P.slate,bg:P.slateBg,ring:P.slateRing,pc:P.pBlue, _hl:0,_pulse:0,active:true},
      {id:'ibkr',   label:'IBKR',     sub:'P5 · broker',     x:c3,y:padT+ph*4+gap*4,  w:pw,h:ph,col:P.slate,bg:P.slateBg,ring:P.slateRing,pc:P.pBlue, _hl:0,_pulse:0,active:true},
      {id:'tasty',  label:'Tastyworks',sub:'P6 · broker',     x:c3,y:padT+ph*5+gap*5,  w:pw,h:ph,col:P.slate,bg:P.slateBg,ring:P.slateRing,pc:P.pBlue, _hl:0,_pulse:0,active:true},
    ];

    // DuckDB analytical store
    DUCKDB={id:'duckdb',label:'DuckDB',sub:'analytical cache',x:c4,y:padT+availH*0.1,w:W*0.11,h:availH*0.4,col:P.amber,bg:P.amberBg,ring:P.amberRing,_hl:0,_pulse:0};

    // Redis event bus
    REDIS={id:'redis',label:'Redis',sub:'event bus / streams',x:c4,y:padT+availH*0.58,w:W*0.11,h:availH*0.32,col:P.teal,bg:P.tealBg,ring:P.tealRing,_hl:0,_pulse:0};

    buildPaths();
  }

  function buildPaths(){
    // Consumers → Resolver
    CONSUMERS.forEach(function(c){PATHS['c_'+c.id]={sx:br(c),sy:bcy(c),cx1:br(c)+W*0.04,cy1:bcy(c),cx2:bl(RESOLVER)-W*0.02,cy2:bcy(RESOLVER),tx:bl(RESOLVER),ty:bcy(RESOLVER)};});
    // Resolver → Providers
    PROVIDERS.forEach(function(p){PATHS['r_'+p.id]={sx:br(RESOLVER),sy:bcy(RESOLVER),cx1:br(RESOLVER)+W*0.03,cy1:bcy(RESOLVER),cx2:bl(p)-W*0.02,cy2:bcy(p),tx:bl(p),ty:bcy(p)};});
    // Resolver → DuckDB
    PATHS.r_db={sx:br(RESOLVER),sy:bcy(RESOLVER)+H*0.04,cx1:br(RESOLVER)+W*0.04,cy1:bcy(RESOLVER)+H*0.04,cx2:bl(DUCKDB)-W*0.02,cy2:bcy(DUCKDB),tx:bl(DUCKDB),ty:bcy(DUCKDB)};
    // Resolver → Redis (live streams fan out over the event bus)
    PATHS.r_redis={sx:br(RESOLVER),sy:bcy(RESOLVER)+H*0.08,cx1:br(RESOLVER)+W*0.06,cy1:bb(REDIS),cx2:bl(REDIS)-W*0.02,cy2:bcy(REDIS),tx:bl(REDIS),ty:bcy(REDIS)};
  }

  function pathPoint(p,t){var e=t<0.5?2*t*t:-1+(4-2*t)*t;return{x:(1-e)*(1-e)*(1-e)*p.sx+3*(1-e)*(1-e)*e*p.cx1+3*(1-e)*e*e*p.cx2+e*e*e*p.tx,y:(1-e)*(1-e)*(1-e)*p.sy+3*(1-e)*(1-e)*e*p.cy1+3*(1-e)*e*e*p.cy2+e*e*e*p.ty};}
  function shadow(s,c){ctx.shadowBlur=s;ctx.shadowColor=c;}
  function noShadow(){ctx.shadowBlur=0;ctx.shadowColor='transparent';}

  function drawNode(b){
    var hl=b._hl||0,r=8*dpr,x=bl(b),y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05)shadow(18*dpr*hl,rgba(b.col,0.3*hl));
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);ctx.fillStyle=b.bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65):(hov?rgba(b.col,0.55):rgba(b.col,0.25));ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);ctx.stroke();noShadow();
    if(b._pulse>0){ctx.beginPath();ctx.roundRect(x-b._pulse*9*dpr,y-b._pulse*9*dpr,b.w+b._pulse*18*dpr,b.h+b._pulse*18*dpr,r+b._pulse*9*dpr);ctx.strokeStyle=rgba(b.col,b._pulse*0.3);ctx.lineWidth=dpr*1.5;ctx.stroke();}
    ctx.fillStyle=b.col;ctx.font='700 '+fs(12)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.label,b.x,b.y+b.h*0.37);
    ctx.fillStyle=P.muted;ctx.font='400 '+fs(9.5)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.fillText(b.sub,b.x,b.y+b.h*0.68);
  }

  function drawConnectors(){
    ctx.setLineDash([4*dpr,4*dpr]);ctx.lineWidth=dpr*0.8;
    CONSUMERS.forEach(function(c){var p=PATHS['c_'+c.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(c.col,0.18);ctx.stroke();});
    PROVIDERS.forEach(function(pv,i){
      var p=PATHS['r_'+pv.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);
      ctx.strokeStyle=i<2?rgba(P.blue,0.25):rgba(P.slate,0.15);ctx.stroke();
    });
    [PATHS.r_db].forEach(function(p){ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(P.amber,0.20);ctx.stroke();});
    [PATHS.r_redis].forEach(function(p){ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(P.teal,0.20);ctx.stroke();});
    ctx.setLineDash([]);

    // Priority labels
    var fs2=fs(8);ctx.font='600 '+fs2+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.fillStyle=rgba(P.amber,0.7);ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText('priority chain →', bl(RESOLVER)+4*dpr, bt(RESOLVER)+H*0.03);
  }

  var TIPS={
    moneta:'Moneta requests price series, holdings data, and macro rates through SanthoshIAS. Gets all six providers for free.',
    flowdeck:'FlowDeck requests real-time options flow and vol surface data. ThetaData is primary; QuantData fills gaps.',
    apex:'APEX requests options chains, equity prices, and broker positions. IBKR and Tastyworks provide order routing.',
    resolver:'The DataResolver: every request enters here. Routes to the highest-priority provider that can answer. If that provider fails, falls through to the next. Consumers never know which provider answered.',
    theta:'Priority 1 for options data. ThetaData Options Pro — full OPRA feed, real-time prints. Most requests resolve here.',
    qd:'Priority 2. QuantData provides vol surface data and flow classification. Also used when ThetaData has coverage gaps.',
    dxlink:'Priority 3. DXLink streaming data — fallback for real-time equity and options when higher-priority feeds are delayed.',
    alpaca:'Priority 4. Alpaca — equity prices, historical data, and paper trading order routing.',
    ibkr:'Priority 5. IBKR — live broker data and order routing for managed accounts.',
    tasty:'Priority 6. Tastyworks — broker data and options order routing. Six bugs fixed in the connector before it worked correctly.',
    duckdb:'Resolved data is written to DuckDB. Repeat queries for the same data are served from cache — reducing API call volume and keeping data consistent across Moneta, FlowDeck, and APEX.',
    redis:'Redis streams carry the live push side — DXLink quotes and flow updates fan out over the event bus, so each consumer subscribes once and SanthoshIAS handles reconnect, backfill, and de-duplication behind it.',
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

  function Particle(consumerIdx){
    var c=CONSUMERS[consumerIdx];this.cid=c.id;this.col=c.pc;this.phase=0;this.t=0;this.speed=0.016+Math.random()*0.009;
    this.size=dpr*(1.8+Math.random()*0.7);this.sx=br(c);this.sy=bcy(c);this.tx=0;this.ty=0;this.history=[];this.pathKey=null;
    // Pick a provider weighted by priority
    this.provIdx=Math.random()<0.6?0:Math.random()<0.6?1:Math.floor(Math.random()*4+2);
    this.setTarget();
  }
  Particle.prototype.setTarget=function(){
    if(this.phase===0){var p=PATHS['c_'+this.cid];this.tx=p.tx;this.ty=p.ty;this.pathKey='c_'+this.cid;}
    else if(this.phase===1){this.tx=RESOLVER.x;this.ty=bcy(RESOLVER);this.pathKey=null;}
    else if(this.phase===2){var pv=PROVIDERS[this.provIdx];this.tx=bl(pv);this.ty=bcy(pv);this.pathKey='r_'+pv.id;}
    else if(this.phase===3){this.tx=DUCKDB.x;this.ty=bcy(DUCKDB);this.pathKey='r_db';}
  };
  Particle.prototype.currentPos=function(){
    if(this.pathKey&&PATHS[this.pathKey])return pathPoint(PATHS[this.pathKey],this.t);
    var e=this.t<0.5?2*this.t*this.t:-1+(4-2*this.t)*this.t;return{x:(1-e)*this.sx+e*this.tx,y:(1-e)*this.sy+e*this.ty};
  };
  Particle.prototype.update=function(){
    this.t+=this.speed;var pos=this.currentPos();this.history.push({x:pos.x,y:pos.y});if(this.history.length>10)this.history.shift();
    if(this.t>=1){this.t=0;this.sx=this.tx;this.sy=this.ty;this.pathKey=null;this.phase++;
      if(this.phase===2){RESOLVER._hl=1;RESOLVER._pulse=1;}
      if(this.phase===3){var pv=PROVIDERS[this.provIdx];pv._hl=1;pv._pulse=1;}
      if(this.phase===4){DUCKDB._hl=0.8;return true;}
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

  function fire(idx){for(var i=0;i<2;i++)(function(ii){setTimeout(function(){particles.push(new Particle(idx));},ii*220);})(i);}
  function scheduleAuto(){fire(Math.floor(Math.random()*CONSUMERS.length));autoTimer=setTimeout(scheduleAuto,800+Math.random()*700);}

  function tick(){
    ctx.clearRect(0,0,W,H);
    var all=CONSUMERS.concat([RESOLVER]).concat(PROVIDERS).concat([DUCKDB,REDIS]);
    all.forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.025);if(b._pulse)b._pulse=Math.max(0,b._pulse-0.035);});
    drawConnectors();
    all.forEach(drawNode);
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    if(hoveredNode)drawTooltip(hoveredNode);requestAnimationFrame(tick);
  }

  canvas.addEventListener('mousemove',function(e){
    var rect=canvas.getBoundingClientRect(),mx=(e.clientX-rect.left)*dpr,my=(e.clientY-rect.top)*dpr;
    var all=CONSUMERS.concat([RESOLVER]).concat(PROVIDERS).concat([DUCKDB,REDIS]);hoveredNode=null;
    for(var i=0;i<all.length;i++){if(inside(all[i],mx,my)){hoveredNode=all[i];break;}}canvas.style.cursor=hoveredNode?'help':'default';
  });
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});
  window.addEventListener('resize',function(){layout();});
  layout();tick();scheduleAuto();
});
