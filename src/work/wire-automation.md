---
layout: case-study.njk
tags: work
title: "$350B in wires, 0% to 99%+ STP — no new vendor tool"
context: "A top PE firm · Treasury & Middle Office · 2022–2026"
order: 1
description: "How a purpose-built wire automation platform on Kyriba, SWIFT, and Goldman Sachs Transaction Banking rails took a top PE firm from manual wire operations to 99%+ straight-through processing."
stats:
  - { n: "$350B+", label: "wires since inception" }
  - { n: "0%→99%+", label: "straight-through processing" }
  - { n: "99.9%", label: "instructed via SWIFT" }
  - { n: "0", label: "missed deadlines in 3 years" }
---
## The problem

At institutional scale, wires are where operational risk concentrates. When I joined the treasury and middle-office modernization effort at a top PE firm, wire operations looked the way they still do at most alternative asset managers: instructions assembled manually, executed through bank portals and fax, tracked in spreadsheets, and dependent on a handful of people who knew where the bodies were buried. Straight-through processing stood at 0%. Volume was growing fast — the kind of growth that turns a manual process from an annoyance into a genuine risk position.

## The obvious (wrong) answer

A third-party vendor came to the table with a proposal. Their plan: they would build the front end — the UI that treasury staff would interact with. We would do the heavy lift: all back-end reference data maintenance, the APIs to store and retrieve data for their interface, and the integration work connecting it to Kyriba and the banking rails. We would own the complexity. They would own the surface.

Reading that proposal made the answer clear. We were being asked to build the hard part of the system regardless — so why were we also paying for their front end? The firm already owned the right rails: Kyriba as the treasury management system, SWIFT connectivity, and a Goldman Sachs Transaction Banking relationship. What was missing wasn't a platform; it was the connective tissue — payment workflows, integration specifications, reference data discipline, and exception handling designed around how the middle office actually works.

## What we built

A modular, configuration-driven wire-processing platform on the infrastructure the firm already owned. The design principle from day one was horizontal scale without rework: new funds, teams, and standing settlement instructions are added as configuration, not code — no deployment, no developer involvement. Payment sources — REST APIs, flat files, same-day real-time payments — are normalized into a single shape before entering the processing core, and adding a new source type requires only configuration. Individual funds can be enabled or disabled at any granularity: per fund, per team, or any combination the business needs.

<div class="arch-diagram">
<canvas id="archCanvas" height="380"></canvas>
<div class="arch-controls">
  <button class="arch-btn active" onclick="fireSource('api')">Fire REST API wire</button>
  <button class="arch-btn" onclick="fireSource('file')">Fire flat file</button>
  <button class="arch-btn" onclick="fireSource('zday')">Fire 0-day payment</button>
  <button class="arch-btn" onclick="fireAll()">Fire all</button>
  <button class="arch-btn active" onclick="toggleAuto()" id="autoBtn">Auto: ON</button>
</div>
<div class="arch-stats">
  <div class="arch-stat"><div class="arch-stat-num" id="wireCount">0</div><div class="arch-stat-lbl">wires processed</div></div>
  <div class="arch-stat"><div class="arch-stat-num">$350B+</div><div class="arch-stat-lbl">since inception</div></div>
  <div class="arch-stat"><div class="arch-stat-num">99%+</div><div class="arch-stat-lbl">STP rate</div></div>
  <div class="arch-stat"><div class="arch-stat-num">99.9%</div><div class="arch-stat-lbl">via SWIFT</div></div>
</div>
<div class="arch-caption">Live simulation of the wire flow — sources normalize and route through the platform core to execution rails. Click to fire individual payment types or watch the auto mode.</div>
</div>
<script>
(function(){
const canvas=document.getElementById('archCanvas');
const ctx=canvas.getContext('2d');
let W,H,dpr=window.devicePixelRatio||1;
let particles=[],wireCount=0,autoMode=true,autoTimer=null;
const C={amber:'#EF9F27',amberD:'#A8763B',teal:'#1D9E75',tealD:'#0F6E56',blue:'#378ADD',blueD:'#185FA5',purple:'#7F77DD',purpleD:'#534AB7',gray:'#888780',accent:'#A8763B',muted:'#6B665E',text:'#1A1A1A',bg:'#FAF8F4',card:'#FFFFFF',hairline:'rgba(26,26,26,0.12)'};
let SRC=[],MODS=[],EXEC=[],srcX,modX,execX;

function layout(){
  dpr=window.devicePixelRatio||1;
  W=canvas.offsetWidth*dpr; H=canvas.height*dpr;
  canvas.width=W; canvas.height=H;
  srcX=W*0.10; modX=W*0.42; execX=W*0.90;
  const pad=H*0.07,gap=H*0.03;
  const sh=(H-pad*2-gap*2)/3;
  SRC=[
    {id:'api',label:'REST APIs',sub:'real-time',x:srcX,y:pad,w:W*0.15,h:sh,col:C.amber,colD:C.amberD},
    {id:'file',label:'Flat files',sub:'batch',x:srcX,y:pad+sh+gap,w:W*0.15,h:sh,col:C.amber,colD:C.amberD},
    {id:'zday',label:'0-day payments',sub:'same-day',x:srcX,y:pad+sh*2+gap*2,w:W*0.15,h:sh,col:C.amber,colD:C.amberD},
  ];
  const mh=(H-pad*2-gap*3)/4;
  MODS=[
    {id:'norm',label:'Normalize data',sub:'unify all source formats',x:modX,y:pad,w:W*0.44,h:mh,col:C.amber,colD:C.amberD},
    {id:'cfg',label:'Configuration module',sub:'funds · teams · SSIs — data not code',x:modX,y:pad+mh+gap,w:W*0.44,h:mh,col:C.purple,colD:C.purpleD},
    {id:'en',label:'Enable / disable',sub:'per fund · per team · any granularity',x:modX,y:pad+mh*2+gap*2,w:W*0.44,h:mh,col:C.purple,colD:C.purpleD},
    {id:'stp',label:'STP core engine',sub:'validate · match SSI · route',x:modX,y:pad+mh*3+gap*3,w:W*0.44,h:mh,col:C.teal,colD:C.tealD},
  ];
  const eh=(H-pad*2-gap*2)/3;
  EXEC=[
    {label:'Kyriba TMS',sub:'treasury mgmt',x:execX,y:pad,w:W*0.14,h:eh,col:C.blue,colD:C.blueD},
    {label:'SWIFT',sub:'99.9% of wires',x:execX,y:pad+eh+gap,w:W*0.14,h:eh,col:C.blue,colD:C.blueD},
    {label:'Bank APIs',sub:'direct rails',x:execX,y:pad+eh*2+gap*2,w:W*0.14,h:eh,col:C.blue,colD:C.blueD},
  ];
}

function hex2rgb(h,a){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}
function bcy(b){return b.y+b.h/2;}
function drawBox(b,hl=0){
  const r=7*dpr,x=b.x-b.w/2,y=b.y;
  ctx.beginPath();ctx.roundRect(x,y,b.w,b.h,r);
  ctx.fillStyle=hex2rgb(b.col,0.12+hl*0.15);ctx.fill();
  ctx.strokeStyle=hex2rgb(b.colD,0.5+hl*0.4);ctx.lineWidth=dpr*(hl?1.5:0.8);ctx.stroke();
  const fs=Math.max(10,13*dpr/2);
  ctx.fillStyle=b.colD;ctx.font=`600 ${fs}px -apple-system,system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(b.label,b.x,b.y+b.h*0.38);
  ctx.fillStyle=C.muted;ctx.font=`${Math.max(8,10*dpr/2)}px -apple-system,system-ui,sans-serif`;
  ctx.fillText(b.sub,b.x,b.y+b.h*0.68);
}
function drawPlatformBox(){
  const p=10*dpr,m=MODS[0],ml=MODS[MODS.length-1];
  const x=m.x-m.w/2-p,y=m.y-p,w=m.w+p*2,h=ml.y+ml.h-m.y+p*2;
  ctx.beginPath();ctx.roundRect(x,y,w,h,12*dpr);
  ctx.fillStyle=hex2rgb(C.teal,0.04);ctx.fill();
  ctx.strokeStyle=hex2rgb(C.tealD,0.25);ctx.lineWidth=dpr;ctx.setLineDash([4*dpr,4*dpr]);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=hex2rgb(C.tealD,0.5);ctx.font=`500 ${Math.max(9,10*dpr/2)}px -apple-system,system-ui,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('Payment automation platform',m.x,y+4*dpr);
}
function drawConnectors(){
  ctx.setLineDash([3*dpr,3*dpr]);ctx.lineWidth=dpr*0.6;ctx.strokeStyle=hex2rgb(C.gray,0.25);
  SRC.forEach(s=>{
    const m=MODS[0],sx=s.x+s.w/2,sy=bcy(s),tx=m.x-m.w/2,ty=bcy(m);
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(sx+W*0.07,sy,tx-W*0.07,ty,tx,ty);ctx.stroke();
  });
  for(let i=0;i<MODS.length-1;i++){
    const a=MODS[i],b=MODS[i+1];
    ctx.beginPath();ctx.moveTo(a.x,a.y+a.h);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  const lm=MODS[MODS.length-1];
  EXEC.forEach(e=>{
    const sx=lm.x+lm.w/2,sy=bcy(lm),tx=e.x-e.w/2,ty=bcy(e);
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(sx+W*0.07,sy,tx-W*0.07,ty,tx,ty);ctx.stroke();
  });
  ctx.setLineDash([]);
}

class Particle{
  constructor(si){
    const s=SRC[si];this.si=si;this.phase=0;this.t=0;this.speed=0.014+Math.random()*0.008;
    this.ei=Math.floor(Math.random()*EXEC.length);this.col=s.col;this.size=dpr*(2+Math.random()*0.8);
    this.sx=s.x+s.w/2;this.sy=bcy(s);this.tx=0;this.ty=0;this.setTarget();
  }
  setTarget(){
    const m0=MODS[0];
    if(this.phase===0){this.tx=m0.x-m0.w/2;this.ty=bcy(m0);}
    else if(this.phase>=1&&this.phase<=4){const m=MODS[this.phase-1];this.tx=m.x;this.ty=bcy(m);}
    else if(this.phase===5){const e=EXEC[this.ei];this.tx=e.x-e.w/2;this.ty=bcy(e);}
  }
  update(){
    this.t+=this.speed;
    if(this.t>=1){
      this.t=0;this.sx=this.tx;this.sy=this.ty;this.phase++;
      if(this.phase===6){wireCount++;document.getElementById('wireCount').textContent=wireCount;return true;}
      this.setTarget();
      if(this.phase>=1&&this.phase<=4)MODS[this.phase-1]._hl=1;
    }
    return false;
  }
  draw(){
    const ease=t=>t<0.5?2*t*t:-1+(4-2*t)*t,et=ease(this.t);
    const mx=(this.sx+this.tx)/2,my=(this.sy+this.ty)/2-H*0.04;
    const bx=(1-et)*(1-et)*this.sx+2*(1-et)*et*mx+et*et*this.tx;
    const by=(1-et)*(1-et)*this.sy+2*(1-et)*et*my+et*et*this.ty;
    for(let i=3;i>=0;i--){
      const tt=Math.max(0,this.t-i*0.05),e2=ease(tt);
      const bx2=(1-e2)*(1-e2)*this.sx+2*(1-e2)*e2*mx+e2*e2*this.tx;
      const by2=(1-e2)*(1-e2)*this.sy+2*(1-e2)*e2*my+e2*e2*this.ty;
      ctx.beginPath();ctx.arc(bx2,by2,this.size*(0.3+i*0.15),0,Math.PI*2);
      ctx.fillStyle=hex2rgb(this.col,0.12*(4-i));ctx.fill();
    }
    ctx.beginPath();ctx.arc(bx,by,this.size,0,Math.PI*2);ctx.fillStyle=this.col;ctx.fill();
    ctx.beginPath();ctx.arc(bx,by,this.size*2,0,Math.PI*2);ctx.fillStyle=hex2rgb(this.col,0.2);ctx.fill();
  }
}

function fireSource(id){const idx=SRC.findIndex(s=>s.id===id);if(idx>=0)for(let i=0;i<3;i++)setTimeout(()=>particles.push(new Particle(idx)),i*200);}
function fireAll(){['api','file','zday'].forEach(id=>fireSource(id));}
function toggleAuto(){
  autoMode=!autoMode;
  const btn=document.getElementById('autoBtn');
  btn.textContent='Auto: '+(autoMode?'ON':'OFF');
  btn.classList.toggle('active',autoMode);
  if(autoMode)scheduleAuto();else clearTimeout(autoTimer);
}
function scheduleAuto(){
  if(!autoMode)return;
  fireSource(['api','file','zday','api'][Math.floor(Math.random()*4)]);
  autoTimer=setTimeout(scheduleAuto,700+Math.random()*700);
}
function draw(){
  ctx.clearRect(0,0,W,H);
  drawConnectors();drawPlatformBox();
  MODS.forEach(m=>{if(m._hl)m._hl=Math.max(0,(m._hl||0)-0.025);});
  SRC.forEach(b=>drawBox(b,0));MODS.forEach(b=>drawBox(b,b._hl||0));EXEC.forEach(b=>drawBox(b,0));
  particles=particles.filter(p=>{const done=p.update();p.draw();return!done;});
  requestAnimationFrame(draw);
}
function init(){layout();draw();scheduleAuto();}
window.addEventListener('resize',()=>{layout();});
setTimeout(init,80);
})();
</script>

Payment initiation was standardized across middle-office teams; instructions flow through Kyriba and out via SWIFT, with the Goldman Sachs Transaction Banking integration carrying execution. I owned the business architecture and integration design: API contract analysis and field mapping between platforms, payment workflow definition, SOW and vendor negotiation, and the process re-engineering that turned common failure modes into handled cases rather than morning surprises. The rollout deliberately attacked the error taxonomy — production issues, recurring user errors, data quality — because STP is won in the last few percent, not the first ninety.

## What changed

Straight-through processing went from 0% to 99%+, with 99.9% of transactions instructed via SWIFT. The platform has processed $350B+ in wires since inception and absorbed roughly 18x volume growth without headcount growth and without architectural rework — a direct consequence of the configuration-driven design. New funds and teams onboarded by adding data, not by touching the system. Entity onboarding — KYC, account opening, funding — compressed to about three days, and the operation has gone three years without a missed deadline. The work was recognized in the Adam Smith Awards 2024 (Highly Commended, Top Treasury Team); the public write-up is here: [Lean team delivers complete transformation](https://treasurytoday.com/asa-2024-winners/lean-team-delivers-complete-transformation/).

## Why this generalizes

The lesson isn't "never buy vendor tools." The firm buys plenty of them, and I've recommended vendors where the situation warranted it. The lesson is that the build-vs-buy question is downstream of an architecture question: what do you already own, and what's actually missing? When the missing piece is connective tissue rather than a platform, an in-house extension is cheaper, faster, and leaves you owning the asset. Answering that question honestly requires someone who can read the vendor landscape, the API contracts, and the operational reality at the same time — which is precisely the seat I like to occupy.
