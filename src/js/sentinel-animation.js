document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('sentinelCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [], hoveredNode = null, autoTimer = null, sickTimer = null;

  var P = {
    text:'#1A1714', muted:'#8A8480',
    teal:  '#1A7A5E', tealBg:  'rgba(26,122,94,0.09)', tealRing:  'rgba(26,122,94,0.22)',
    amber: '#B86A00', amberBg: 'rgba(184,106,0,0.10)', amberRing: 'rgba(184,106,0,0.24)',
    slate: '#3D5A80', slateBg: 'rgba(61,90,128,0.09)', slateRing: 'rgba(61,90,128,0.22)',
    indigo:'#4F46A0', indigoBg:'rgba(79,70,160,0.09)', indigoRing:'rgba(79,70,160,0.22)',
    red:   '#9B2335', redBg:   'rgba(155,35,53,0.10)', redRing:   'rgba(155,35,53,0.30)',
    pGreen:'#10B981', pAmber:'#F59E0B', pRed:'#EF4444',
  };

  function rgba(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'rgba('+r+','+g+','+b+','+a+')';}
  function bl(b){return b.x-b.w/2;} function br(b){return b.x+b.w/2;}
  function bt(b){return b.y;}        function bb(b){return b.y+b.h;}
  function bcy(b){return b.y+b.h/2;}
  function inside(b,mx,my){return mx>=bl(b)&&mx<=br(b)&&my>=bt(b)&&my<=bb(b);}
  function fs(base){return Math.max(base*dpr*0.62,base*0.9);}

  var W,H,SENTINEL,SERVICES=[],LAUNCHD,PLAYBOOKS,PATHS={};

  function layout(){
    var cw=canvas.parentElement.clientWidth-8,ch=380;
    canvas.style.width=cw+'px';canvas.style.height=ch+'px';
    canvas.width=Math.floor(cw*dpr);canvas.height=Math.floor(ch*dpr);
    W=canvas.width;H=canvas.height;
    var padT=H*0.06,availH=H-padT-H*0.06,gap=H*0.02;
    var c1=W*0.08,c2=W*0.42,c3=W*0.80;

    SENTINEL={id:'sentinel',label:'Sentinel',sub:'admin dashboard',x:c1,y:padT+availH*0.24,w:W*0.16,h:availH*0.52,col:P.amber,bg:P.amberBg,ring:P.amberRing,_hl:0,_pulse:0};

    var sh=(availH-gap*5)/6,sw=W*0.20;
    var defs=[
      ['ias','SanthoshIAS','data service layer',true],
      ['mapi','Moneta API','launchd · finance backend',true],
      ['mweb','Moneta Web','launchd · finance frontend',true],
      ['fd','FlowDeck','flow analytics',true],
      ['apexapi','APEX API','Sentinel-supervised',false],
      ['apexui','APEX UI','trading frontend',false],
    ];
    SERVICES=defs.map(function(d,i){return {id:d[0],label:d[1],sub:d[2],native:d[3],x:c2,y:padT+i*(sh+gap),w:sw,h:sh,col:P.slate,bg:P.slateBg,ring:P.slateRing,_hl:0,_pulse:0,sick:0};});

    LAUNCHD={id:'launchd',label:'launchd',sub:'native OS supervision',x:c3,y:padT+availH*0.08,w:W*0.15,h:availH*0.34,col:P.teal,bg:P.tealBg,ring:P.tealRing,_hl:0,_pulse:0};
    PLAYBOOKS={id:'playbooks',label:'Playbooks',sub:'condition → action',x:c3,y:padT+availH*0.6,w:W*0.15,h:availH*0.34,col:P.indigo,bg:P.indigoBg,ring:P.indigoRing,_hl:0,_pulse:0};

    buildPaths();
  }

  function buildPaths(){
    SERVICES.forEach(function(s){
      PATHS['h_'+s.id]={sx:br(SENTINEL),sy:bcy(SENTINEL),cx1:br(SENTINEL)+W*0.05,cy1:bcy(SENTINEL),cx2:bl(s)-W*0.03,cy2:bcy(s),tx:bl(s),ty:bcy(s)};
      var anchor=s.native?LAUNCHD:PLAYBOOKS;
      PATHS['u_'+s.id]={sx:br(s),sy:bcy(s),cx1:br(s)+W*0.04,cy1:bcy(s),cx2:bl(anchor)-W*0.02,cy2:bcy(anchor),tx:bl(anchor),ty:bcy(anchor)};
    });
    PATHS.pb_sentinel={sx:bl(PLAYBOOKS),sy:bcy(PLAYBOOKS),cx1:bl(PLAYBOOKS)-W*0.06,cy1:bcy(PLAYBOOKS),cx2:br(SENTINEL)+W*0.04,cy2:bb(SENTINEL)-H*0.03,tx:br(SENTINEL),ty:bb(SENTINEL)-H*0.03};
  }

  function pathPoint(p,t){var e=t<0.5?2*t*t:-1+(4-2*t)*t;return{x:(1-e)*(1-e)*(1-e)*p.sx+3*(1-e)*(1-e)*e*p.cx1+3*(1-e)*e*e*p.cx2+e*e*e*p.tx,y:(1-e)*(1-e)*(1-e)*p.sy+3*(1-e)*(1-e)*e*p.cy1+3*(1-e)*e*e*p.cy2+e*e*e*p.ty};}
  function shadow(s,c){ctx.shadowBlur=s;ctx.shadowColor=c;}
  function noShadow(){ctx.shadowBlur=0;ctx.shadowColor='transparent';}

  function drawNode(b){
    var hl=b._hl||0,r=8*dpr,x=bl(b),y=bt(b);
    var hov=hoveredNode&&hoveredNode.id===b.id;
    var sick=b.sick||0;
    var col=sick>0.05?P.red:b.col, ring=sick>0.05?P.redRing:b.ring, bg=sick>0.05?P.redBg:b.bg;
    if(hl>0.05)shadow(18*dpr*hl,rgba(col,0.3*hl));
    ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);ctx.fillStyle=bg;ctx.fill();
    ctx.strokeStyle=hl>0.1?rgba(col,0.65):(hov?rgba(col,0.55):rgba(col,0.28));ctx.lineWidth=dpr*(hl>0.1?1.8:1.0);ctx.stroke();noShadow();
    if(b._pulse>0){ctx.beginPath();ctx.roundRect(x-b._pulse*9*dpr,y-b._pulse*9*dpr,b.w+b._pulse*18*dpr,b.h+b._pulse*18*dpr,r+b._pulse*9*dpr);ctx.strokeStyle=rgba(col,b._pulse*0.32);ctx.lineWidth=dpr*1.5;ctx.stroke();}
    // status dot
    ctx.beginPath();ctx.arc(x+b.w-10*dpr,y+10*dpr,3.2*dpr,0,Math.PI*2);ctx.fillStyle=sick>0.05?P.red:P.teal;ctx.fill();
    ctx.fillStyle=col;ctx.font='700 '+fs(12)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.label,b.x,b.y+b.h*0.37);
    ctx.fillStyle=P.muted;ctx.font='400 '+fs(9)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.fillText(b.sub,b.x,b.y+b.h*0.7);
  }

  function drawConnectors(){
    ctx.setLineDash([4*dpr,4*dpr]);ctx.lineWidth=dpr*0.8;
    SERVICES.forEach(function(s){var p=PATHS['h_'+s.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(P.amber,0.16);ctx.stroke();});
    SERVICES.forEach(function(s){var p=PATHS['u_'+s.id];ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=s.native?rgba(P.teal,0.20):rgba(P.indigo,0.16);ctx.stroke();});
    var p=PATHS.pb_sentinel;ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.bezierCurveTo(p.cx1,p.cy1,p.cx2,p.cy2,p.tx,p.ty);ctx.strokeStyle=rgba(P.indigo,0.18);ctx.stroke();
    ctx.setLineDash([]);
    ctx.font='600 '+fs(8)+'px -apple-system,BlinkMacSystemFont,"Inter",sans-serif';ctx.fillStyle=rgba(P.amber,0.7);ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText('health checks →',bl(SENTINEL)+4*dpr,bt(SENTINEL)-H*0.005);
  }

  var TIPS={
    sentinel:'Sentinel runs as a launchd job and starts on boot. One view of every service in the stack — is each one actually doing its job, not just is the process alive. Start, stop, restart from one interface, in dependency order.',
    ias:'SanthoshIAS — the data-provider service layer. Sentinel checks that the options tape is fresh, not just that the process is up. Runs as a native launchd unit.',
    mapi:'Moneta API — finance backend. Real launchd unit (com.belgavi.monetaapi); the OS keeps it alive, Sentinel reads and controls its state.',
    mweb:'Moneta Web — finance frontend. Real launchd unit (com.belgavi.monetaweb).',
    fd:'FlowDeck — flow analytics frontend. Supervised for lifecycle and health alongside the rest of the stack.',
    apexapi:'APEX API. Loads a 225-variable secrets file that has no business in a launchd plist, so Sentinel runs it under its own supervisor with the same guarantees.',
    apexui:'APEX UI — the React trading frontend. Brought up after the APEX API is ready.',
    launchd:'Native OS supervision. Where a service can be a launchd unit, it is — SanthoshIAS and both Moneta services. Survives reboot without Sentinel.',
    playbooks:'Codified condition → action rules. fd_tape_freshness: when the SanthoshIAS tape is stale for 18 consecutive polls, Sentinel restarts the feed automatically — before the first app error. Every recurring failure becomes a playbook.',
  };

  function drawTooltip(b){
    var text=TIPS[b.id];if(!text)return;
    var maxW=Math.min(W*0.30,230*dpr),fsize=fs(10);
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

  // kind: 'health' (Sentinel->svc green) | 'fix' (Sentinel->svc amber, clears sick)
  function Particle(svcIdx,kind){
    var s=SERVICES[svcIdx];this.sid=s.id;this.kind=kind;this.t=0;
    this.col=kind==='fix'?P.pAmber:P.pGreen;
    this.speed=(kind==='fix'?0.020:0.015)+Math.random()*0.006;
    this.size=dpr*(kind==='fix'?2.4:1.9);
    this.pathKey='h_'+s.id;this.history=[];
  }
  Particle.prototype.pos=function(){return pathPoint(PATHS[this.pathKey],this.t);};
  Particle.prototype.update=function(){
    this.t+=this.speed;var p=this.pos();this.history.push(p);if(this.history.length>10)this.history.shift();
    if(this.t>=1){
      var s=SERVICES.filter(function(x){return x.id===this.sid;}.bind(this))[0];
      if(s){s._hl=1;s._pulse=this.kind==='fix'?1:0.5;if(this.kind==='fix')s.sick=0;}
      PLAYBOOKS._hl=this.kind==='fix'?1:PLAYBOOKS._hl;
      return true;
    }
    return false;
  };
  Particle.prototype.draw=function(){
    var p=this.pos();
    for(var i=0;i<this.history.length;i++){var h=this.history[i],f=i/this.history.length;ctx.beginPath();ctx.arc(h.x,h.y,this.size*(0.12+f*0.35),0,Math.PI*2);ctx.fillStyle=rgba(this.kind==='fix'?'#F59E0B':'#10B981',f*0.18);ctx.fill();}
    var g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,this.size*3.5);g.addColorStop(0,rgba(this.kind==='fix'?'#F59E0B':'#10B981',0.4));g.addColorStop(1,rgba(this.kind==='fix'?'#F59E0B':'#10B981',0));
    ctx.beginPath();ctx.arc(p.x,p.y,this.size*3.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,this.size,0,Math.PI*2);ctx.fillStyle=this.col;ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,this.size*0.4,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fill();
  };

  var hb=0;
  function scheduleAuto(){
    // round-robin health check
    particles.push(new Particle(hb%SERVICES.length,'health'));hb++;
    // remediate any sick service
    SERVICES.forEach(function(s,i){if(s.sick>0.5&&Math.random()<0.5){SENTINEL._hl=1;particles.push(new Particle(i,'fix'));}});
    autoTimer=setTimeout(scheduleAuto,650+Math.random()*450);
  }
  function scheduleSick(){
    var healthy=SERVICES.map(function(s,i){return s.sick>0.5?-1:i;}).filter(function(i){return i>=0;});
    if(healthy.length){var idx=healthy[Math.floor(Math.random()*healthy.length)];SERVICES[idx].sick=1;PLAYBOOKS._pulse=1;PLAYBOOKS._hl=1;}
    sickTimer=setTimeout(scheduleSick,3200+Math.random()*2600);
  }

  function tick(){
    ctx.clearRect(0,0,W,H);
    var all=[SENTINEL].concat(SERVICES).concat([LAUNCHD,PLAYBOOKS]);
    all.forEach(function(b){if(b._hl)b._hl=Math.max(0,b._hl-0.025);if(b._pulse)b._pulse=Math.max(0,b._pulse-0.035);});
    drawConnectors();
    all.forEach(drawNode);
    particles=particles.filter(function(p){var done=p.update();p.draw();return!done;});
    if(hoveredNode)drawTooltip(hoveredNode);
    requestAnimationFrame(tick);
  }

  canvas.addEventListener('mousemove',function(e){
    var rect=canvas.getBoundingClientRect(),mx=(e.clientX-rect.left)*dpr,my=(e.clientY-rect.top)*dpr;
    var all=[SENTINEL].concat(SERVICES).concat([LAUNCHD,PLAYBOOKS]);hoveredNode=null;
    for(var i=0;i<all.length;i++){if(inside(all[i],mx,my)){hoveredNode=all[i];break;}}
    canvas.style.cursor=hoveredNode?'help':'default';
  });
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});
  window.addEventListener('resize',function(){layout();});
  layout();tick();scheduleAuto();scheduleSick();
});
