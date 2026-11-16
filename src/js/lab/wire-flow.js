// 3D wire flow. Payments rise from source pillars, then either climb the automation
// platform on a helix, pass through the SWIFT ring and arc out to the bank towers,
// or drop to the operations desk, where they heap up waiting to be re-keyed.
//
// How to extend this file:
//   LAYOUT  where every structure sits in space (x = flow, y = height, z = depth)
//   SIM     speeds, service times and rates for the simulation
//   LOOK    colours and glow
// Below those blocks: build the scene, build the paths, run the simulation.
// The numbers in SIM are illustrative. They are not client data.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const LAYOUT = {
  sources: [
    { label: "Margin calls", sub: "REST API", x: -13, z: -5.5, h: 2.6 },
    { label: "Loan settlements", sub: "flat file", x: -14.5, z: 0, h: 4.2 },
    { label: "Same-day payments", sub: "real time", x: -13, z: 5.5, h: 1.6 },
  ],
  platform: {
    x: 0, z: -1, size: 5.2, helixRadius: 1.7, helixTurns: 2.5, baseY: 0.7,
    layers: [
      { label: "Normalize", sub: "one payment shape", y: 1.6 },
      { label: "Rules + reference data", sub: "funds, teams, instructions", y: 3.4 },
      { label: "Approval workflow", sub: "by fund and team", y: 5.2, approval: true },
      { label: "Payment instruction", sub: "treasury system", y: 7.0 },
    ],
    topY: 8.2,
  },
  swift: { label: "SWIFT", sub: "MT103", x: 7.5, y: 8.2, z: -1, radius: 1.35 },
  banks: [
    { x: 15, z: -7.5, h: 9.5 }, { x: 16.5, z: -2.8, h: 6.2 },
    { x: 15.5, z: 1.8, h: 7.8 }, { x: 16.8, z: 6.4, h: 5.0 },
  ],
  desk: { label: "Operations desk", sub: "re-key by hand", x: -3.5, z: 8.5, w: 4.4, d: 3.2, h: 0.35 },
  portals: { label: "Bank portals + fax", sub: "one bank at a time", x: 7, z: 8.5, gap: 1.3, radius: 0.5 },
};

const SIM = {
  baseRate: 2.2,        // payments per second at volume x1
  autoSpeed: 11,        // scene units per second
  manualSpeed: 2.6,
  approvalDwell: 0.3,   // seconds a straight-through payment pauses at the approval layer
  deskClerks: 4,        // people re-keying at the desk
  deskService: 1.6,     // seconds per payment per clerk
  portalReject: 0.08,   // share of manual payments sent back for rework
  maxParticles: 900,
  maxStp: 0.999,
};

const LOOK = {
  bg: 0x100d0a, floor: 0x1b1712, grid: 0x3a3126,
  structure: 0x2a241c, edge: 0xc99a56,
  auto: new THREE.Color(0xffc468).multiplyScalar(1.9),     // above 1.0 so it blooms
  reject: new THREE.Color(0xff5a4a).multiplyScalar(1.7),
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.82 },
};

// ---------- renderer, camera, glow ----------
const stage = document.getElementById("wf-stage");
const canvas = document.getElementById("wf-canvas");
const labelLayer = document.getElementById("wf-labels");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(LOOK.bg);
scene.fog = new THREE.FogExp2(LOOK.bg, 0.011);

const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 300);
const controls = new OrbitControls(camera, canvas);
const HOME_TARGET = new THREE.Vector3(1, 3.8, 0.5);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495; // stay above the floor
controls.minDistance = 6;
controls.maxDistance = 90;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), LOOK.bloom.strength, LOOK.bloom.radius, LOOK.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a1410, 0.9));
const key = new THREE.DirectionalLight(0xffe2b8, 1.6);
key.position.set(-10, 22, 14);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7fa4d6, 0.7);
rim.position.set(18, 8, -16);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(70, 64),
  new THREE.MeshStandardMaterial({ color: LOOK.floor, roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new THREE.GridHelper(140, 70, LOOK.grid, LOOK.grid);
grid.position.y = 0.01;
grid.material.transparent = true; grid.material.opacity = 0.45;
scene.add(grid);

// ---------- structures ----------
const fadeAuto = [], fadeManual = []; // materials that fade with the slider
const labels = [];
function addLabel(text, sub, pos, cls) {
  const el = document.createElement("div");
  el.className = "wf-label " + (cls || "");
  el.innerHTML = `<strong>${text}</strong>` + (sub ? `<span>${sub}</span>` : "");
  labelLayer.appendChild(el);
  labels.push({ el, pos, cls: cls || "" });
}
function solid(geo, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: LOOK.structure, roughness: 0.6, metalness: 0.25, transparent: true, ...opts });
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: LOOK.edge, transparent: true, opacity: 0.7 }));
  mesh.add(edges);
  scene.add(mesh);
  return { mesh, mat, edgeMat: edges.material };
}

// source pillars: payments leave from the top
const sourceTops = LAYOUT.sources.map((s) => {
  const { mesh } = solid(new THREE.CylinderGeometry(0.9, 1.1, s.h, 6));
  mesh.position.set(s.x, s.h / 2, s.z);
  addLabel(s.label, s.sub, new THREE.Vector3(s.x, s.h + 0.9, s.z));
  return new THREE.Vector3(s.x, s.h + 0.25, s.z);
});

// automation platform: glass floors stacked into a tower
const P = LAYOUT.platform;
for (const layer of P.layers) {
  const g = solid(new THREE.BoxGeometry(P.size, 0.16, P.size), { color: 0xd9b074, opacity: 0.16, roughness: 0.2, metalness: 0, depthWrite: false });
  g.mesh.position.set(P.x, layer.y, P.z);
  fadeAuto.push({ mat: g.mat, base: 0.16 }, { mat: g.edgeMat, base: 0.95 });
  addLabel(layer.label, layer.sub, new THREE.Vector3(P.x + P.size / 2 + 0.3, layer.y + 0.1, P.z + P.size / 2), "wf-label-layer wf-auto");
}
for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // four corner posts
  const post = solid(new THREE.BoxGeometry(0.12, P.topY - 0.4, 0.12), { color: 0x6b5330 });
  post.mesh.position.set(P.x + dx * P.size / 2, (P.topY - 0.4) / 2, P.z + dz * P.size / 2);
  fadeAuto.push({ mat: post.mat, base: 1 }, { mat: post.edgeMat, base: 0.7 });
}
addLabel("Automation platform", "", new THREE.Vector3(P.x, P.topY + 1.5, P.z), "wf-label-title wf-auto");

// SWIFT: a ring every straight-through payment passes through
const W = LAYOUT.swift;
const ringMat = new THREE.MeshStandardMaterial({ color: 0x3a2c18, emissive: 0xffb44d, emissiveIntensity: 1.5, transparent: true });
const ring = new THREE.Mesh(new THREE.TorusGeometry(W.radius, 0.1, 12, 64), ringMat);
ring.position.set(W.x, W.y, W.z);
ring.rotation.y = Math.PI / 2;
scene.add(ring);
const mast = solid(new THREE.CylinderGeometry(0.07, 0.07, W.y - W.radius, 8), { color: 0x6b5330 });
mast.mesh.position.set(W.x, (W.y - W.radius) / 2, W.z);
fadeAuto.push({ mat: ringMat, base: 1 }, { mat: mast.mat, base: 1 });
addLabel(W.label, W.sub, new THREE.Vector3(W.x, W.y + W.radius + 0.6, W.z), "wf-auto");

// bank towers: light up when a payment lands
const banks = LAYOUT.banks.map((b) => {
  const g = solid(new THREE.BoxGeometry(1.9, b.h, 1.9), { emissive: 0xffc468, emissiveIntensity: 0 });
  g.mesh.position.set(b.x, b.h / 2, b.z);
  return { top: new THREE.Vector3(b.x, b.h + 0.25, b.z), mat: g.mat, flash: 0 };
});
const tallest = LAYOUT.banks.reduce((a, b) => (b.h > a.h ? b : a));
addLabel("Banks", "funds move", new THREE.Vector3(tallest.x, tallest.h + 1, tallest.z));

// manual lane: a low desk and a row of bank portals
const D = LAYOUT.desk;
const desk = solid(new THREE.BoxGeometry(D.w, D.h, D.d), { color: 0x2c333b });
desk.mesh.position.set(D.x, D.h / 2, D.z);
desk.edgeMat.color.set(0x8ea2b8);
fadeManual.push({ mat: desk.mat, base: 1 }, { mat: desk.edgeMat, base: 0.8 });
addLabel(D.label, D.sub, new THREE.Vector3(D.x, 0.1, D.z + D.d / 2 + 1.3), "wf-manual");

const PT = LAYOUT.portals;
const portalPos = banks.map((_, i) => new THREE.Vector3(PT.x, PT.radius + 0.15, PT.z + (i - (banks.length - 1) / 2) * PT.gap));
for (const p of portalPos) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8ea2b8, roughness: 0.5, transparent: true });
  const gate = new THREE.Mesh(new THREE.TorusGeometry(PT.radius, 0.05, 8, 32), mat);
  gate.position.copy(p); gate.rotation.y = Math.PI / 2;
  scene.add(gate);
  fadeManual.push({ mat, base: 1 });
}
addLabel(PT.label, PT.sub, new THREE.Vector3(PT.x, 0.1, PT.z + (banks.length / 2) * PT.gap + 1.2), "wf-manual");

// ---------- paths through space ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const curve = (pts) => new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
function tube(c, list, color, opacity, radius = 0.035) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 96, radius, 6), mat));
  list.push({ mat, base: opacity });
  return c;
}
function helixPoints(y0, y1, a0, a1) {
  const pts = [], n = 48;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t;
    pts.push(V(P.x + Math.cos(a) * P.helixRadius, y0 + (y1 - y0) * t, P.z + Math.sin(a) * P.helixRadius));
  }
  return pts;
}
const approvalY = P.layers.find((l) => l.approval).y;
const totalAngle = P.helixTurns * Math.PI * 2, aStart = Math.PI; // enter on the source side
const aApproval = aStart + totalAngle * ((approvalY - P.baseY) / (P.topY - P.baseY));
const helixEntry = helixPoints(P.baseY, P.baseY, aStart, aStart)[0];
const TUBE_A = 0xe2ad62, TUBE_M = 0x7f93a8;

const PATH = {
  // straight through: pillar top -> helix base, up to approval, up to the top, through the ring, out to a bank
  toPlatform: sourceTops.map((s) => tube(curve([s, V(s.x + 3, s.y + 1.2, s.z * 0.7), V((s.x + helixEntry.x) / 2, 1.2, s.z * 0.35 + P.z * 0.5), helixEntry]), fadeAuto, TUBE_A, 0.32)),
  climbA: tube(curve(helixPoints(P.baseY, approvalY, aStart, aApproval)), fadeAuto, TUBE_A, 0.4),
  climbB: tube(curve(helixPoints(approvalY, P.topY, aApproval, aStart + totalAngle)), fadeAuto, TUBE_A, 0.4),
  // by hand: pillar top -> down to the desk, desk -> a portal, portal -> bank
  toDesk: sourceTops.map((s) => tube(curve([s, V(s.x + 2.5, s.y + 0.6, s.z + 1.5), V(D.x - 3.5, 1.4, D.z - 0.5), V(D.x - 0.4, D.h + 0.3, D.z)]), fadeManual, TUBE_M, 0.3, 0.025)),
};
const helixTop = PATH.climbB.getPoint(1);
PATH.toBank = banks.map((b) => tube(curve([
  helixTop, V(W.x - 2.5, W.y + 0.2, W.z), V(W.x, W.y, W.z), V(W.x + 2.5, W.y + 0.4, W.z + (b.top.z - W.z) * 0.15),
  V((W.x + b.top.x) / 2 + 1, Math.max(W.y, b.top.y) + 2.2, (W.z + b.top.z) / 2), b.top,
]), fadeAuto, TUBE_A, 0.32));
PATH.toPortal = portalPos.map((p) => tube(curve([V(D.x + D.w / 2, D.h + 0.3, D.z), V((D.x + p.x) / 2, 0.9, (D.z + p.z) / 2), V(p.x - 1, p.y, p.z), p]), fadeManual, TUBE_M, 0.3, 0.025));
PATH.portalToBank = banks.map((b, i) => tube(curve([portalPos[i], V(portalPos[i].x + 3, 0.8, portalPos[i].z), V(b.top.x - 2.2, b.top.y * 0.55, b.top.z + 1.2), V(b.top.x - 0.9, b.top.y + 1.1, b.top.z + 0.4), b.top]), fadeManual, TUBE_M, 0.3, 0.025));

// ---------- payments ----------
// Two instanced meshes: straight-through and rejected payments glow (unlit, bright);
// manual payments are matte spheres lit by the scene, so the heap reads as solid objects.
function instanced(material) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 14, 10), material, SIM.maxParticles);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0; m.frustumCulled = false;
  scene.add(m);
  return m;
}
const glowMesh = instanced(new THREE.MeshBasicMaterial({ toneMapped: false }));
const matteMesh = instanced(new THREE.MeshStandardMaterial({ color: 0x9fb2c6, roughness: 0.55, metalness: 0.1 }));

let particles = [];
let deskQueue = [];  // waiting for a clerk
let deskBusy = [];   // being re-keyed
const stats = { autoDone: 0, manualDone: 0, reworked: 0 };
const state = { stp: SIM.maxStp, volume: 1, playing: true, spawnDebt: 0 };

// Each payment follows a list of legs. A leg is a curve plus what happens at its end.
function legsFor(lane, src, bank) {
  return lane === "auto"
    ? [{ c: PATH.toPlatform[src] }, { c: PATH.climbA, end: "approval" }, { c: PATH.climbB }, { c: PATH.toBank[bank], end: "bank" }]
    : [{ c: PATH.toDesk[src], end: "desk" }, { c: PATH.toPortal[bank], end: "portal" }, { c: PATH.portalToBank[bank], end: "bank" }];
}
function spawn() {
  if (particles.length >= SIM.maxParticles) return;
  const src = Math.floor(Math.random() * sourceTops.length);
  const bank = Math.floor(Math.random() * banks.length);
  const lane = Math.random() < state.stp ? "auto" : "manual";
  particles.push({ lane, bank, legs: legsFor(lane, src, bank), i: 0, u: 0, dir: 1, mode: "move", wait: 0, rejected: false, pos: sourceTops[src].clone() });
}

function arrive(p, what) {
  if (what === "bank") {
    stats[p.lane === "auto" ? "autoDone" : "manualDone"]++;
    banks[p.bank].flash = 1;
    return false; // settled
  }
  if (what === "approval") { p.mode = "dwell"; p.wait = SIM.approvalDwell; }
  else if (what === "desk") { p.mode = "queue"; deskQueue.push(p); }
  else if (what === "portal") {
    if (Math.random() < SIM.portalReject) { p.rejected = true; p.dir = -1; stats.reworked++; } // back to the desk
    else { p.i++; p.u = 0; }
  }
  return true;
}

function step(dt) {
  state.spawnDebt += dt * SIM.baseRate * state.volume;
  while (state.spawnDebt >= 1) { spawn(); state.spawnDebt -= 1; }

  // the desk: a fixed number of clerks, each takes deskService seconds per payment
  deskBusy = deskBusy.filter((p) => {
    p.wait -= dt;
    if (p.wait > 0) return true;
    p.mode = "move"; p.i = 1; p.u = 0; p.dir = 1;
    return false;
  });
  while (deskBusy.length < SIM.deskClerks && deskQueue.length) {
    const p = deskQueue.shift();
    p.mode = "service"; p.wait = SIM.deskService;
    deskBusy.push(p);
  }

  const alive = [];
  for (const p of particles) {
    let keep = true;
    if (p.mode === "move") {
      const leg = p.legs[p.i];
      const speed = p.lane === "auto" ? SIM.autoSpeed : SIM.manualSpeed;
      p.u += (p.dir * speed * dt) / leg.c.getLength();
      if (p.u >= 1) {
        p.u = 1; leg.c.getPointAt(1, p.pos);
        if (leg.end) keep = arrive(p, leg.end); else { p.i++; p.u = 0; }
      } else if (p.u <= 0) {                 // a rejected payment is back at the desk
        p.u = 0; p.dir = 1; p.mode = "queue"; deskQueue.push(p);
      } else leg.c.getPointAt(p.u, p.pos);
    } else if (p.mode === "dwell") {
      p.wait -= dt;
      if (p.wait <= 0) { p.mode = "move"; p.i++; p.u = 0; }
    }
    if (keep) alive.push(p);
  }
  particles = alive;

  // waiting payments stack into a heap on the desk, so the backlog has real height
  const side = 5, sp = 0.37;
  deskQueue.forEach((p, n) => {
    const layer = Math.floor(n / (side * side)), k = n % (side * side);
    p.pos.set(D.x - 1.2 + (k % side) * sp, D.h + 0.18 + layer * sp, D.z - 0.75 + Math.floor(k / side) * sp);
  });
  deskBusy.forEach((p, n) => p.pos.set(D.x + D.w / 2 - 0.4, D.h + 0.18, D.z - 0.4 + n * 0.8));

  for (const b of banks) { b.flash = Math.max(0, b.flash - dt * 2.2); b.mat.emissiveIntensity = b.flash * 0.9; }
}

const m4 = new THREE.Matrix4();
function drawParticles() {
  let g = 0, m = 0;
  for (const p of particles) {
    m4.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
    if (p.lane === "auto" || p.rejected) {
      glowMesh.setMatrixAt(g, m4);
      glowMesh.setColorAt(g++, p.rejected ? LOOK.reject : LOOK.auto);
    } else matteMesh.setMatrixAt(m++, m4);
  }
  glowMesh.count = g; matteMesh.count = m;
  glowMesh.instanceMatrix.needsUpdate = true; matteMesh.instanceMatrix.needsUpdate = true;
  if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
}

// the unused lane dims with the slider so the picture matches the number
function applyLaneEmphasis() {
  const a = 0.18 + 0.82 * state.stp, m = 0.18 + 0.82 * (1 - state.stp);
  fadeAuto.forEach((f) => (f.mat.opacity = f.base * a));
  fadeManual.forEach((f) => (f.mat.opacity = f.base * m));
  ringMat.emissiveIntensity = 0.25 + 1.5 * state.stp;
  for (const l of labels) {
    l.el.style.opacity = l.cls.includes("wf-auto") ? 0.3 + 0.7 * a : l.cls.includes("wf-manual") ? 0.3 + 0.7 * m : 1;
  }
}

// ---------- camera ----------
// Frame the whole scene for the current shape of the stage.
function homePosition(aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(19 / (tanV * aspect), 11 / tanV) * 1.02;
  const el = THREE.MathUtils.degToRad(17), az = THREE.MathUtils.degToRad(-24);
  return V(HOME_TARGET.x + dist * Math.cos(el) * Math.sin(az), HOME_TARGET.y + dist * Math.sin(el), HOME_TARGET.z + dist * Math.cos(el) * Math.cos(az));
}
const VIEWS = {
  overview: () => ({ pos: homePosition(camera.aspect), target: HOME_TARGET.clone() }),
  platform: () => ({ pos: V(P.x - 7, 7.5, P.z + 10.5), target: V(P.x + 1.5, 4.6, P.z) }),
  desk:     () => ({ pos: V(D.x - 6.5, 3.2, D.z + 8), target: V(D.x + 1, 1.4, D.z - 1) }),
  banks:    () => ({ pos: V(24, 13, 14), target: V(12, 5.5, -1) }),
};
let fly = null, userMoved = false;
function flyTo(name) {
  const to = VIEWS[name]();
  fly = { t: 0, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), ...to };
  userMoved = name !== "overview";
}
controls.addEventListener("start", () => { userMoved = true; fly = null; setOrbit(false); });

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 52 : 40;
  camera.updateProjectionMatrix();
  if (!userMoved && !fly) camera.position.copy(homePosition(w / h));
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- labels and controls ----------
const v = new THREE.Vector3();
function placeLabels(w, h) {
  for (const l of labels) {
    v.copy(l.pos).project(camera);
    l.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    l.el.hidden = v.z > 1 || v.z < -1;
  }
}

const $ = (id) => document.getElementById(id);
const fmtPct = (x) => (x * 100).toFixed(x >= 0.99 && x < 1 ? 1 : 0) + "%";
function updateHud() {
  $("wf-stp-out").textContent = fmtPct(state.stp);
  $("wf-vol-out").textContent = "×" + state.volume;
  $("wf-queue").textContent = deskQueue.length;
  $("wf-auto").textContent = stats.autoDone;
  $("wf-manual").textContent = stats.manualDone;
  $("wf-rework").textContent = stats.reworked;
  $("wf-queue").classList.toggle("wf-hot", deskQueue.length > 12);
}
function reset() {
  particles = []; deskQueue = []; deskBusy = [];
  stats.autoDone = stats.manualDone = stats.reworked = 0;
}
function setOrbit(on) {
  controls.autoRotate = on;
  $("wf-orbit").classList.toggle("active", on);
}

$("wf-stp").addEventListener("input", (e) => {
  state.stp = Math.min(SIM.maxStp, e.target.value / 1000);
  journey = null;
  applyLaneEmphasis();
});
$("wf-vol").addEventListener("input", (e) => { state.volume = +e.target.value; });
$("wf-play").addEventListener("click", (e) => {
  state.playing = !state.playing;
  e.target.textContent = state.playing ? "Pause" : "Play";
});
$("wf-reset").addEventListener("click", reset);
$("wf-orbit").addEventListener("click", () => setOrbit(!controls.autoRotate));
document.querySelectorAll("[data-wf-view]").forEach((b) => b.addEventListener("click", () => flyTo(b.dataset.wfView)));

// "Play the journey": hold at 0%, then ramp to 99.9%
let journey = null;
$("wf-journey").addEventListener("click", () => {
  reset();
  journey = { t: 0, hold: 6, ramp: 9 };
  state.playing = true; $("wf-play").textContent = "Pause";
});
function runJourney(dt) {
  if (!journey) return;
  journey.t += dt;
  const k = Math.min(1, Math.max(0, (journey.t - journey.hold) / journey.ramp));
  state.stp = SIM.maxStp * k * k * (3 - 2 * k);
  $("wf-stp").value = Math.round(state.stp * 1000);
  applyLaneEmphasis();
  if (k >= 1) journey = null;
}

// ---------- loop ----------
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  state.playing = false; $("wf-play").textContent = "Play";
  setOrbit(false);
  for (let i = 0; i < 240; i++) step(1 / 30); // show a populated frame instead of an empty one
}
applyLaneEmphasis();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.playing) { runJourney(dt); step(dt); }
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.2);
    const k = fly.t * fly.t * (3 - 2 * fly.t);
    camera.position.lerpVectors(fly.fromPos, fly.pos, k);
    controls.target.lerpVectors(fly.fromTarget, fly.target, k);
    if (fly.t >= 1) fly = null;
  }
  controls.update();
  drawParticles();
  composer.render();
  placeLabels(stage.clientWidth, stage.clientHeight);
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
