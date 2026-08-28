document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('monetaCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [];
  var txCount = 0;
  var autoTimer = null;
  var hoveredNode = null;

  // Warm palette — distinct from wire animation
  var P = {
    text:    '#1A1714', muted:   '#8A8480',
    green:   '#1A7A5E', greenBg: 'rgba(26,122,94,0.09)',  greenRing:'rgba(26,122,94,0.22)',
    indigo:  '#4F46A0', indigoBg:'rgba(79,70,160,0.09)',  indigoRing:'rgba(79,70,160,0.22)',
    amber:   '#B86A00', amberBg: 'rgba(184,106,0,0.09)',  amberRing:'rgba(184,106,0,0.22)',
    rose:    '#9B2335', roseBg:  'rgba(155,35,53,0.08)',  roseRing:  'rgba(155,35,53,0.22)',
    blue:    '#1A5FAA', blueBg:  'rgba(26,95,170,0.09)',  blueRing:  'rgba(26,95,170,0.22)',
    slate:   '#3D5A80', slateBg: 'rgba(61,90,128,0.09)', slateRing: 'rgba(61,90,128,0.22)',
    rust:    '#8B4513', rustBg:  'rgba(139,69,19,0.08)',  rustRing:  'rgba(139,69,19,0.22)',
    // particle colours
    pGreen: '#10B981', pBlue: '#3B82F6', pAmber: '#F59E0B', pIndigo: '#818CF8',
  };

  function rgba(hex, a) {
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  function bl(b){return b.x-b.w/2;} function br(b){return b.x+b.w/2;}
  function bt(b){return b.y;}        function bb(b){return b.y+b.h;}
  function bcy(b){return b.y+b.h/2;}
  function inside(b,mx,my){return mx>=bl(b)&&mx<=br(b)&&my>=bt(b)&&my<=bb(b);}
  function fs(base){return Math.max(base*dpr*0.62, base*0.9);}

  var W, H;
  var SOURCES=[], CORE=[], DASH=[], PATHS={};

  function layout(){
    var cw=canvas.parentElement.clientWidth-8, ch=480;
    canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr); canvas.height=Math.floor(ch*dpr);
    W=canvas.width; H=canvas.height;

    var padT=H*0.05, padB=H*0.05, availH=H-padT-padB;
    var gap=H*0.022;
    var c1=W*0.09, c2=W*0.35, c3=W*0.65, c4=W*0.91;

    // ── Data sources (left) — 6 items
    var sw=W*0.13, sh=(availH-gap*5)/6;
    SOURCES=[
      {id:'simplfin', label:'SimpleFIN',   sub:'bank/card/loan',   x:c1,y:padT,             w:sw,h:sh,col:P.green, bg:P.greenBg, ring:P.greenRing, pc:P.pGreen,  _hl:0,_pulse:0},
      {id:'plaid',    label:'Plaid',       sub:'more institutions', x:c1,y:padT+sh+gap,      w:sw,h:sh,col:P.green, bg:P.greenBg, ring:P.greenRing, pc:P.pGreen,  _hl:0,_pulse:0},
      {id:'ibkr',     label:'IBKR Flex',   sub:'positions XML',     x:c1,y:padT+sh*2+gap*2,  w:sw,h:sh,col:P.blue,  bg:P.blueBg,  ring:P.blueRing,  pc:P.pBlue,   _hl:0,_pulse:0},
      {id:'tasty',    label:'Tastytrade',  sub:'options accounts',  x:c1,y:padT+sh*3+gap*3,  w:sw,h:sh,col:P.blue,  bg:P.blueBg,  ring:P.blueRing,  pc:P.pBlue,   _hl:0,_pulse:0},
      {id:'csv',      label:'CSV inbox',   sub:'manual imports',    x:c1,y:padT+sh*4+gap*4,  w:sw,h:sh,col:P.slate, bg:P.slateBg, ring:P.slateRing, pc:P.pIndigo, _hl:0,_pulse:0},
      {id:'ias',      label:'SanthoshIAS', sub:'live quotes',       x:c1,y:padT+sh*5+gap*5,  w:sw,h:sh,col:P.rust,  bg:P.rustBg,  ring:P.rustRing,  pc:P.pAmber,  _hl:0,_pulse:0},
    ];

    // ── Core engine (centre) — 3 stacked modules
    var mw=W*0.22, mh=(availH-gap*2)/3;
    CORE=[
      {id:'sqlite',  label:'SQLite',      sub:'better-sqlite3 · Drizzle · WAL',   x:c2,y:padT,           w:mw,h:mh,col:P.amber, bg:P.amberBg, ring:P.amberRing, _hl:0,_pulse:0},
      {id:'hono',    label:'Hono API',    sub:'performance · categorization · cache',x:c2,y:padT+mh+gap,  w:mw,h:mh,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,_hl:0,_pulse:0},
      {id:'horizon', label:'Moneta Horizon',sub:'Monte Carlo · tax engine · optimizer',x:c2,y:padT+mh*2+gap*2,w:mw,h:mh,col:P.rose,  bg:P.roseBg,  ring:P.roseRing,  _hl:0,_pulse:0},
    ];

    // ── Dashboard modules (right) — 5 items
    var dw=W*0.20, dh=(availH-gap*4)/5;
    DASH=[
      {id:'cashflow',  label:'Cash flow',      sub:'Sankey · income vs spend',    x:c3,y:padT,            w:dw,h:dh,col:P.green, bg:P.greenBg, ring:P.greenRing, _hl:0,_pulse:0},
      {id:'invest',    label:'Investments',    sub:'TWR · MWR · Sharpe · maxDD',  x:c3,y:padT+dh+gap,     w:dw,h:dh,col:P.blue,  bg:P.blueBg,  ring:P.blueRing,  _hl:0,_pulse:0},
      {id:'ai',        label:'AI alternatives',sub:'fund swap scoring engine',    x:c3,y:padT+dh*2+gap*2, w:dw,h:dh,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,_hl:0,_pulse:0},
      {id:'proj',      label:'Projections',    sub:'Monte Carlo · Roth optimizer', x:c3,y:padT+dh*3+gap*3, w:dw,h:dh,col:P.rose,  bg:P.roseBg,  ring:P.roseRing,  _hl:0,_pulse:0},
      {id:'networth',  label:'Net worth',      sub:'25+ accounts · 3yr history',  x:c3,y:padT+dh*4+gap*4, w:dw,h:dh,col:P.slate, bg:P.slateBg, ring:P.slateRing, _hl:0,_pulse:0},
    ];

    // ── iOS app (far right)
    var iw=W*0.09, ih=availH*0.55;
    var iosNode = {
      id:'ios', label:'iOS / iPadOS',
      lines:['SwiftUI','WidgetKit','Sankey canvas'],
      x:c4, y:padT + (availH-ih)/2,
      w:iw, h:ih,
      col:P.blue, bg:P.blueBg, ring:P.blueRing, _hl:0, _pulse:0
    };
    DASH.push(iosNode);

    buildPaths();
  }

  function buildPaths(){
    // Source → SQLite (primary store)
    SOURCES.forEach(function(s, i){
      PATHS['src_'+s.id] = {
        sx:br(s), sy:bcy(s),
        cx1:br(s)+W*0.05, cy1:bcy(s),
        cx2:bl(CORE[0])-W*0.03, cy2:bcy(CORE[0]),
        tx:bl(CORE[0]), ty:bcy(CORE[0])
      };
    });
    // SQLite → Hono
    PATHS.db_api = {
      sx:CORE[0].x, sy:bb(CORE[0]),
      cx1:CORE[0].x, cy1:bb(CORE[0])+H*0.03,
      cx2:CORE[1].x, cy2:bt(CORE[1])-H*0.03,
      tx:CORE[1].x, ty:bt(CORE[1])
    };
    // Hono → Horizon
    PATHS.api_horizon = {
      sx:CORE[1].x, sy:bb(CORE[1]),
      cx1:CORE[1].x, cy1:bb(CORE[1])+H*0.03,
      cx2:CORE[2].x, cy2:bt(CORE[2])-H*0.03,
      tx:CORE[2].x, ty:bt(CORE[2])
    };
    // Hono/Horizon → Dashboard modules
    DASH.slice(0,5).forEach(function(d, i){
      var src = (i >= 3) ? CORE[2] : CORE[1]; // projections from Horizon
      PATHS['core_'+d.id] = {
        sx:br(src), sy:bcy(src),
        cx1:br(src)+W*0.04, cy1:bcy(src),
        cx2:bl(d)-W*0.03, cy2:bcy(d),
        tx:bl(d), ty:bcy(d)
      };
    });
    // Dashboard → iOS
    var ios = DASH[5];
    PATHS.dash_ios = {
      sx:br(DASH[1]), sy:bcy(DASH[1]),
      cx1:br(DASH[1])+W*0.03, cy1:bcy(DASH[1]),
      cx2:bl(ios)-W*0.02, cy2:bcy(ios),
      tx:bl(ios), ty:bcy(ios)
    };
  }

  function pathPoint(p, t){
    var e=t<0.5?2*t*t:-1+(4-2*t)*t;
    return {
      x:(1-e)*(1-e)*(1-e)*p.sx+3*(1-e)*(1-e)*e*p.cx1+3*(1-e)*e*e*p.cx2+e*e*e*p.tx,
      y:(1-e)*(1-e)*(1-e)*p.sy+3*(1-e)*(1-e)*e*p.cy1+3*(1-e)*e*e*p.cy2+e*e*e*p.ty
    };
  }

  // ── DRAWING ─────────────────────────────────────────────

  function shadow(spread, col){ ctx.shadowBlur=spread; ctx.shadowColor=col; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; }
  function noShadow(){ ctx.shadowBlur=0; ctx.shadowColor='transparent'; }

  function drawNode(b){
    var hl=b._hl||0, r=8*dpr, x=bl(b), y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05) shadow(18*dpr*hl, rgba(b.col,0.3*hl));
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=b.bg; ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65+hl*0.2):(hov?rgba(b.col,0.55):rgba(b.col,0.25));
    ctx.lineWidth=dpr*(hl>0.1?1.8:1.0); ctx.stroke();
    noShadow();
    if(b._pulse>0){
      ctx.beginPath(); ctx.roundRect(x-b._pulse*9*dpr,y-b._pulse*9*dpr,b.w+b._pulse*18*dpr,b.h+b._pulse*18*dpr,r+b._pulse*9*dpr);
      ctx.strokeStyle=rgba(b.col,b._pulse*0.3); ctx.lineWidth=dpr*1.5; ctx.stroke();
    }
    ctx.fillStyle=b.col;
    ctx.font='700 '+fs(13)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(b.label, b.x, b.y+b.h*0.37);
    ctx.fillStyle=P.muted;
    ctx.font='400 '+fs(10)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y+b.h*0.68);
  }

  function drawIOSNode(){
    var b=DASH[5], hl=b._hl||0, r=10*dpr, x=bl(b), y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    if(hl>0.05) shadow(18*dpr*hl, rgba(b.col,0.3*hl));
    ctx.beginPath(); ctx.roundRect(x,y,b.w,b.h,r);
    ctx.fillStyle=b.bg; ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(b.col,0.65):(hov?rgba(b.col,0.55):rgba(b.col,0.25));
    ctx.lineWidth=dpr*(hl>0.1?1.8:1.0); ctx.stroke();
    noShadow();
    if(b._pulse>0){
      ctx.beginPath(); ctx.roundRect(x-b._pulse*9*dpr,y-b._pulse*9*dpr,b.w+b._pulse*18*dpr,b.h+b._pulse*18*dpr,r+b._pulse*9*dpr);
      ctx.strokeStyle=rgba(b.col,b._pulse*0.3); ctx.lineWidth=dpr*1.5; ctx.stroke();
    }
    // Phone silhouette
    var pw=b.w*0.45, ph=b.h*0.32, px=b.x-pw/2, py=b.y+b.h*0.08;
    ctx.beginPath(); ctx.roundRect(px,py,pw,ph,4*dpr);
    ctx.strokeStyle=rgba(b.col,0.5); ctx.lineWidth=dpr*1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, py+ph*0.5, pw*0.08, 0, Math.PI*2);
    ctx.fillStyle=rgba(b.col,0.3); ctx.fill();

    var ls=b.lines, fsize=fs(9.5);
    var slotH=(b.h*0.52)/ls.length;
    ls.forEach(function(lbl,i){
      var ly=b.y+b.h*0.48+slotH*(i+0.5);
      ctx.fillStyle=b.col;
      ctx.font='500 '+fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(lbl, b.x, ly);
    });
  }

  function drawGroupBox(nodes, label, col){
    if(!nodes.length) return;
    var p=14*dpr;
    var minX=nodes.reduce(function(m,n){return Math.min(m,bl(n));},Infinity);
    var minY=nodes.reduce(function(m,n){return Math.min(m,bt(n));},Infinity);
    var maxX=nodes.reduce(function(m,n){return Math.max(m,br(n));},-Infinity);
    var maxY=nodes.reduce(function(m,n){return Math.max(m,bb(n));},-Infinity);
    ctx.beginPath(); ctx.roundRect(minX-p,minY-p,maxX-minX+p*2,maxY-minY+p*2,14*dpr);
    ctx.fillStyle=rgba(col,0.025); ctx.fill();
    ctx.strokeStyle=rgba(col,0.13); ctx.lineWidth=dpr;
    ctx.setLineDash([6*dpr,5*dpr]); ctx.stroke(); ctx.setLineDash([]);
    var cx=(minX+maxX)/2;
    ctx.fillStyle=rgba(col,0.5);
    ctx.font='500 '+fs(9)+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(label, cx, minY-p+4*dpr);
  }

  function drawConnectors(){
    // Source → SQLite
    SOURCES.forEach(function(s){
      var p=PATHS['src_'+s.id];
      ctx.beginPath(); ctx.moveTo(p.sx,p.sy);
      ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);
      ctx.strokeStyle=rgba(s.col,0.18); ctx.lineWidth=dpr*0.8;
      ctx.setLineDash([4*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    });
    // SQLite → Hono → Horizon
    [PATHS.db_api, PATHS.api_horizon].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p.sx,p.sy); ctx.lineTo(p.tx,p.ty);
      ctx.strokeStyle=rgba(P.muted,0.20); ctx.lineWidth=dpr*0.8;
      ctx.setLineDash([4*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    });
    // Core → Dashboard
    DASH.slice(0,5).forEach(function(d){
      var p=PATHS['core_'+d.id];
      ctx.beginPath(); ctx.moveTo(p.sx,p.sy);
      ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);
      ctx.strokeStyle=rgba(d.col,0.18); ctx.lineWidth=dpr*0.8;
      ctx.setLineDash([4*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    });
    // Dashboard → iOS
    var ip=PATHS.dash_ios;
    ctx.beginPath(); ctx.moveTo(ip.sx,ip.sy);
    ctx.bezierCurveTo(ip.cx1,ip.cy1,ip.cx2,ip.cy2,ip.tx,ip.ty);
    ctx.strokeStyle=rgba(P.blue,0.18); ctx.lineWidth=dpr*0.8;
    ctx.setLineDash([4*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
  }

  // ── TOOLTIPS ─────────────────────────────────────────────
  var TIPS = {
    simplfin: 'SimpleFIN Bridge connects directly to bank and credit-union APIs — the primary feed for 25+ checking, savings, card, and loan accounts. No screen-scraping.',
    plaid:    'Plaid was added recently to reach institutions SimpleFIN does not cover — same direct-API model, no screen-scraping.',
    ibkr:     'Interactive Brokers Flex Queries — scheduled XML exports of positions, trades, and cash activity for the IBKR investment accounts.',
    tasty:    'The Tastytrade API feeds the options and futures accounts — positions, fills, and running P&L.',
    csv:      'A CSV inbox catches anything the connectors cannot reach — drop a file in, it is parsed and reconciled against existing transactions.',
    ias:      'Live market quotes for held positions route through SanthoshIAS, a small provider-routing layer shared across the stack, with priority-chain failover and an in-process quote cache.',
    sqlite:   'Every transaction, holding snapshot, and computed metric lives in one SQLite file — better-sqlite3, WAL mode, 64MB page cache. Three years of data, queried in milliseconds. Two tables (networth_cache, cashflow_monthly_cache) are materialised views recomputed on write.',
    hono:     'A Hono API (TypeScript, in the Express/Fastify family) handles performance math — TWR, MWR, Sharpe, maxDD — projection runs, and the rules-then-MiniLM-then-Gemma categorization cascade. An in-process TTL cache with write-through invalidation sits in front of the heaviest endpoints; Server-Sent Events push sync progress to the browser.',
    horizon:  'Moneta Horizon runs Monte Carlo projection scenarios (GBM, block bootstrap, regime-switching), a full 2026 federal/Pennsylvania tax engine, a Roth conversion optimizer, and an asset location linear program.',
    cashflow: 'The month as a Sankey diagram — income flowing into spending categories, investments, and savings. Aggregates come from a materialised monthly-cashflow table, so it loads in milliseconds regardless of history depth.',
    invest:   'Investment dashboard across 6 brokerage accounts. Time-Weighted Return separates your performance from your contribution timing. Money-Weighted Return shows your actual dollar outcome. Sharpe and maxDD complete the picture.',
    ai:       'Given a current holding, the AI engine scores potential swap candidates across expense ratio, tracking error, tax efficiency, and factor exposure — producing a ranked shortlist with composite scores.',
    proj:     'Projection fan chart showing the distribution of retirement outcomes across 10,000 Monte Carlo simulations. Not a line — a probability distribution. Includes Roth conversion ladder optimisation and asset location recommendations.',
    networth: 'Net worth tracking across all 25+ accounts — brokerage, bank, card, loan. Three years of daily snapshots, trend line, and account-level breakdown.',
    ios:      'Native iOS/iPadOS/macOS companion app — SwiftUI with WidgetKit integration. Sankey layout computed server-side, rendered via SwiftUI Canvas. Widget size variants map to WidgetKit systemSmall/Medium/Large.',
  };

  function drawTooltip(b){
    var text=TIPS[b.id]; if(!text) return;
    var maxW=Math.min(W*0.30,230*dpr), fsize=fs(10);
    ctx.font=fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    var words=text.split(' '), lines=[], cur='';
    words.forEach(function(w){
      var test=cur?cur+' '+w:w;
      if(ctx.measureText(test).width>maxW-16*dpr){lines.push(cur);cur=w;}else cur=test;
    });
    if(cur) lines.push(cur);
    var lh=fsize*1.55, pad=11*dpr, tw=maxW, th=lines.length*lh+pad*2;
    var tx=b.x-tw/2, ty=bb(b)+10*dpr;
    if(tx<4*dpr) tx=4*dpr;
    if(tx+tw>W-4*dpr) tx=W-tw-4*dpr;
    if(ty+th>H-4*dpr) ty=bt(b)-th-10*dpr;
    shadow(14*dpr,'rgba(0,0,0,0.10)');
    ctx.beginPath(); ctx.roundRect(tx,ty,tw,th,8*dpr);
    ctx.fillStyle='#FFFDF9'; ctx.fill();
    noShadow();
    ctx.strokeStyle=rgba(b.col,0.30); ctx.lineWidth=dpr; ctx.stroke();
    ctx.fillStyle=P.text; ctx.textAlign='left'; ctx.textBaseline='top';
    lines.forEach(function(l,i){ ctx.fillText(l,tx+pad,ty+pad+i*lh); });
  }

  function drawLiveCounter(){
    var pad=12*dpr, y=pad, fsize=fs(10);
    ctx.font='600 '+fsize+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    var text='⟳ '+txCount+' transactions processed';
    var tw=ctx.measureText(text).width+14*dpr, bh=16*dpr;
    var x=W-pad;
    ctx.beginPath(); ctx.roundRect(x-tw,y,tw,bh,5*dpr);
    ctx.fillStyle=rgba(P.green,0.10); ctx.fill();
    ctx.strokeStyle=rgba(P.green,0.20); ctx.lineWidth=dpr*0.7; ctx.stroke();
    ctx.fillStyle=P.green; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(text,x-tw/2,y+bh/2);
  }

  // ── PARTICLES ─────────────────────────────────────────────

  // Types: 'tx' (transaction from source) or 'result' (computed result to dashboard)
  function Particle(srcIdx){
    var s=SOURCES[srcIdx];
    this.type='tx';
    this.srcId=s.id;
    this.col=s.pc;
    this.size=dpr*(1.8+Math.random()*0.8);
    this.speed=0.016+Math.random()*0.008;
    this.phase=0; this.t=0;
    this.sx=br(s); this.sy=bcy(s);
    this.tx=0; this.ty=0;
    this.history=[];
    this.pathKey=null;
    // After hitting SQLite, spawn result particles to dashboard
    this.spawnedResult=false;
    this.setTarget();
  }

  Particle.prototype.setTarget=function(){
    if(this.phase===0){
      // src → SQLite
      var p=PATHS['src_'+this.srcId];
      this.tx=p.tx; this.ty=p.ty; this.pathKey='src_'+this.srcId;
    } else if(this.phase===1){
      // SQLite centre
      this.tx=CORE[0].x; this.ty=bcy(CORE[0]); this.pathKey=null;
    } else if(this.phase===2){
      // SQLite → Hono
      this.tx=CORE[1].x; this.ty=bcy(CORE[1]); this.pathKey='db_api';
    } else if(this.phase===3){
      // Hono → random dashboard output
      var dashIdx=Math.floor(Math.random()*5);
      var d=DASH[dashIdx];
      this.destDash=dashIdx;
      this.tx=bl(d); this.ty=bcy(d);
      this.pathKey='core_'+d.id;
    }
  };

  Particle.prototype.currentPos=function(){
    if(this.pathKey&&PATHS[this.pathKey]){
      return pathPoint(PATHS[this.pathKey],this.t);
    }
    var e=this.t<0.5?2*this.t*this.t:-1+(4-2*this.t)*this.t;
    return{x:(1-e)*this.sx+e*this.tx, y:(1-e)*this.sy+e*this.ty};
  };

  Particle.prototype.update=function(){
    this.t+=this.speed;
    var pos=this.currentPos();
    this.history.push({x:pos.x,y:pos.y});
    if(this.history.length>10) this.history.shift();
    if(this.t>=1){
      this.t=0; this.sx=this.tx; this.sy=this.ty; this.pathKey=null; this.phase++;
      if(this.phase===2){
        CORE[0]._hl=1; CORE[0]._pulse=1;
        txCount++;
        var el=document.getElementById('monetaCount'); if(el)el.textContent=txCount;
      }
      if(this.phase===3){ CORE[1]._hl=0.8; }
      if(this.phase===4){
        if(this.destDash!==undefined) DASH[this.destDash]._hl=1;
        return true;
      }
      if(this.phase>4) return true;
      this.setTarget();
    }
    return false;
  };

  Particle.prototype.draw=function(){
    var pos=this.currentPos();
    for(var i=0;i<this.history.length;i++){
      var h=this.history[i], frac=i/this.history.length;
      ctx.beginPath(); ctx.arc(h.x,h.y,this.size*(0.12+frac*0.35),0,Math.PI*2);
      ctx.fillStyle=rgba(this.col,frac*0.18); ctx.fill();
    }
    var g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,this.size*3.5);
    g.addColorStop(0,rgba(this.col,0.38)); g.addColorStop(1,rgba(this.col,0));
    ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size*3.5,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size,0,Math.PI*2);
    ctx.fillStyle=this.col; ctx.fill();
    ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size*0.4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fill();
  };

  function fireSrc(idx){
    for(var i=0;i<2;i++)(function(ii){
      setTimeout(function(){particles.push(new Particle(idx));},ii*220);
    })(i);
  }

  function fireAll(){
    SOURCES.forEach(function(s,i){
      setTimeout(function(){fireSrc(i);},i*150);
    });
  }

  function scheduleAuto(){
    fireSrc(Math.floor(Math.random()*SOURCES.length));
    autoTimer=setTimeout(scheduleAuto,800+Math.random()*700);
  }

  // ── MAIN LOOP ─────────────────────────────────────────────
  function tick(){
    ctx.clearRect(0,0,W,H);
    var allNodes=SOURCES.concat(CORE).concat(DASH);
    allNodes.forEach(function(b){
      if(b._hl)    b._hl    =Math.max(0,b._hl-0.025);
      if(b._pulse) b._pulse =Math.max(0,b._pulse-0.035);
    });
    drawConnectors();
    drawGroupBox(SOURCES,'Data sources', P.green);
    drawGroupBox(CORE,   'Moneta core',  P.amber);
    drawGroupBox(DASH.slice(0,5), 'Dashboard', P.indigo);
    SOURCES.forEach(drawNode);
    CORE.forEach(drawNode);
    DASH.slice(0,5).forEach(drawNode);
    drawIOSNode();
    drawLiveCounter();
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    if(hoveredNode) drawTooltip(hoveredNode);
    requestAnimationFrame(tick);
  }

  canvas.addEventListener('mousemove',function(e){
    var rect=canvas.getBoundingClientRect();
    var mx=(e.clientX-rect.left)*dpr, my=(e.clientY-rect.top)*dpr;
    var all=SOURCES.concat(CORE).concat(DASH);
    hoveredNode=null;
    for(var i=0;i<all.length;i++){if(inside(all[i],mx,my)){hoveredNode=all[i];break;}}
    canvas.style.cursor=hoveredNode?'help':'default';
  });
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});
  window.addEventListener('resize',function(){layout();});

  layout(); tick(); scheduleAuto();
});
