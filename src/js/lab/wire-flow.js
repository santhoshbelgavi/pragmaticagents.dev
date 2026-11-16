// 3D wire flow: payments travel from source systems to the banks, either through
// the manual desk or straight through the automation platform.
//
// How to extend this file:
//   NODES   add or move a box in the scene (x = left to right, z = depth, w/d = footprint)
//   ROUTES  the ordered node ids a payment visits on each lane
//   SIM     speeds, service times and rates for the simulation
// Everything below those three blocks is rendering and simulation plumbing.
// The numbers in SIM are illustrative. They are not client data.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const NODES = {
  margin:   { label: "Margin calls",       sub: "REST API",        x: -11, z: -3.2, w: 2.6, d: 1.6, lane: "source" },
  loans:    { label: "Loan settlements",   sub: "flat file",       x: -11, z: 0,    w: 2.6, d: 1.6, lane: "source" },
  sameday:  { label: "Same-day payments",  sub: "real time",       x: -11, z: 3.2,  w: 2.6, d: 1.6, lane: "source" },

  normalize:{ label: "Normalize",          sub: "one payment shape", x: -6.5, z: -1.6, w: 1.6, d: 4.4, lane: "auto" },
  core:     { label: "Platform core",      sub: "rules + reference data", x: -2.5, z: -1.6, w: 3, d: 3, lane: "auto" },
  approval: { label: "Approval workflow",  sub: "by fund and team", x: 1.8, z: -1.6, w: 2.4, d: 2.4, lane: "auto" },
  treasury: { label: "Treasury system",    sub: "payment instruction", x: 5.6, z: -1.6, w: 2.2, d: 2.2, lane: "auto" },
  swift:    { label: "SWIFT",              sub: "MT103",           x: 9,   z: -1.6, w: 1.8, d: 1.8, lane: "auto" },

  desk:     { label: "Operations desk",    sub: "re-key by hand",  x: -4,  z: 4.6,  w: 3,   d: 2.2, lane: "manual" },
  portals:  { label: "Bank portals + fax", sub: "one bank at a time", x: 4, z: 4.6, w: 3,   d: 2.2, lane: "manual" },

  banks:    { label: "Banks",              sub: "funds move",      x: 13,  z: 1.2,  w: 2,   d: 5.6, lane: "sink" },
};

const ROUTES = {
  auto:   ["normalize", "core", "approval", "treasury", "swift", "banks"],
  manual: ["desk", "portals", "banks"],
};

const SIM = {
  baseRate: 1.1,        // payments per second at volume x1
  autoSpeed: 9,         // scene units per second
  manualSpeed: 2.4,
  approvalDwell: 0.25,  // seconds a straight-through payment pauses for approval
  deskClerks: 2,        // people re-keying at the desk
  deskService: 1.6,     // seconds per payment per clerk
  portalReject: 0.08,   // share of manual payments sent back for rework
  maxParticles: 700,
  maxStp: 0.999,
};

// ---------- scene ----------
const stage = document.getElementById("wf-stage");
const canvas = document.getElementById("wf-canvas");
const labelLayer = document.getElementById("wf-labels");
const css = getComputedStyle(document.documentElement);
const token = (n, fb) => (css.getPropertyValue(n).trim() || fb);
const COL = {
  bg: new THREE.Color(token("--bg", "#FAF8F4")),
  ink: new THREE.Color(token("--text", "#211E1A")),
  muted: new THREE.Color(token("--muted", "#6B665E")),
  accent: new THREE.Color(token("--accent", "#A8763B")),
  reject: new THREE.Color("#B03030"),
  box: new THREE.Color("#FFFFFF"),
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = COL.bg;
scene.fog = new THREE.Fog(COL.bg, 50, 110);

const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.target.set(1, 0, 0.8);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 12;
controls.maxDistance = 64;
controls.enablePan = false;

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(-8, 18, 10);
scene.add(sun);

const grid = new THREE.GridHelper(60, 60, 0xd9d2c6, 0xe9e4da);
grid.position.y = -0.01;
scene.add(grid);

// ---------- nodes ----------
const NODE_H = 0.7;
const nodeMeshes = {};
const labels = [];
for (const [id, n] of Object.entries(NODES)) {
  const geo = new THREE.BoxGeometry(n.w, NODE_H, n.d);
  const mat = new THREE.MeshStandardMaterial({ color: COL.box, roughness: 0.85, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(n.x, NODE_H / 2, n.z);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: n.lane === "auto" ? COL.accent : COL.ink, transparent: true })
  );
  mesh.add(edges);
  scene.add(mesh);
  nodeMeshes[id] = { mesh, edges, node: n };

  const el = document.createElement("div");
  el.className = "wf-label wf-label-" + n.lane;
  el.innerHTML = `<strong>${n.label}</strong><span>${n.sub}</span>`;
  labelLayer.appendChild(el);
  // the desk label sits at the front edge so the waiting pile does not cover it
  const pos = id === "desk" ? new THREE.Vector3(n.x, 0, n.z + n.d / 2 + 1.1) : new THREE.Vector3(n.x, NODE_H + 0.5, n.z);
  labels.push({ el, id, pos });
}

const center = (id) => new THREE.Vector3(NODES[id].x, NODE_H + 0.35, NODES[id].z);

// ---------- lane lines ----------
function laneLine(points, color) {
  const mat = new THREE.LineBasicMaterial({ color, transparent: true });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
  line.position.y = -NODE_H - 0.3; // draw on the floor, under the particles
  scene.add(line);
  return mat;
}
const sources = Object.keys(NODES).filter((k) => NODES[k].lane === "source");
const laneMats = { auto: [], manual: [] };
for (const s of sources) {
  laneMats.auto.push(laneLine([center(s), center(ROUTES.auto[0])], COL.accent));
  laneMats.manual.push(laneLine([center(s), center(ROUTES.manual[0])], COL.muted));
}
for (const lane of ["auto", "manual"]) {
  const pts = ROUTES[lane].map(center);
  laneMats[lane].push(laneLine(pts, lane === "auto" ? COL.accent : COL.muted));
}

// ---------- particles ----------
const pGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
const pMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
const pMesh = new THREE.InstancedMesh(pGeo, pMat, SIM.maxParticles);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
pMesh.count = 0;
scene.add(pMesh);

let particles = [];
let deskQueue = [];   // manual payments waiting for a clerk
let deskBusy = [];    // manual payments being re-keyed
const stats = { autoDone: 0, manualDone: 0, reworked: 0 };
const state = { stp: SIM.maxStp, volume: 1, playing: true, spawnDebt: 0 };

function spawn() {
  if (particles.length >= SIM.maxParticles) return;
  const src = sources[Math.floor(Math.random() * sources.length)];
  const lane = Math.random() < state.stp ? "auto" : "manual";
  particles.push({
    lane, pos: center(src), path: ROUTES[lane].map(center), ids: ROUTES[lane],
    leg: 0, wait: 0, mode: "move", rejected: false,
  });
}

function step(dt) {
  state.spawnDebt += dt * SIM.baseRate * state.volume;
  while (state.spawnDebt >= 1) { spawn(); state.spawnDebt -= 1; }

  // the desk: a fixed number of clerks, each takes deskService seconds per payment
  deskBusy = deskBusy.filter((p) => {
    p.wait -= dt;
    if (p.wait > 0) return true;
    p.mode = "move"; p.leg = 1;
    return false;
  });
  while (deskBusy.length < SIM.deskClerks && deskQueue.length) {
    const p = deskQueue.shift();
    p.mode = "service"; p.wait = SIM.deskService;
    deskBusy.push(p);
  }

  const alive = [];
  for (const p of particles) {
    if (p.mode === "move") {
      const target = p.path[p.leg];
      const speed = p.lane === "auto" ? SIM.autoSpeed : SIM.manualSpeed;
      const dist = p.pos.distanceTo(target);
      const travel = speed * dt;
      if (travel < dist) {
        p.pos.lerp(target, travel / dist);
      } else {
        p.pos.copy(target);
        const at = p.ids[p.leg];
        if (at === "banks") {
          stats[p.lane === "auto" ? "autoDone" : "manualDone"]++;
          continue; // settled, drop the particle
        }
        if (at === "desk") { p.mode = "queue"; deskQueue.push(p); }
        else if (at === "portals" && Math.random() < SIM.portalReject) {
          p.rejected = true; p.leg = 0; stats.reworked++; // back to the desk for rework
        }
        else if (at === "approval") { p.mode = "dwell"; p.wait = SIM.approvalDwell; }
        else p.leg++;
      }
    } else if (p.mode === "dwell") {
      p.wait -= dt;
      if (p.wait <= 0) { p.mode = "move"; p.leg++; }
    }
    alive.push(p);
  }
  particles = alive;

  // waiting payments pile up above the desk so the backlog is visible
  const d = NODES.desk;
  deskQueue.forEach((p, i) => {
    const perLayer = 12, col = i % perLayer, layer = Math.floor(i / perLayer);
    p.pos.set(d.x - 1.1 + (col % 6) * 0.44, NODE_H + 0.35 + layer * 0.42, d.z - 0.3 + Math.floor(col / 6) * 0.44);
  });
}

const m4 = new THREE.Matrix4();
function drawParticles() {
  pMesh.count = particles.length;
  particles.forEach((p, i) => {
    m4.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
    pMesh.setMatrixAt(i, m4);
    pMesh.setColorAt(i, p.rejected ? COL.reject : p.lane === "auto" ? COL.accent : COL.muted);
  });
  pMesh.instanceMatrix.needsUpdate = true;
  if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}

// lanes fade with the slider so the picture matches the number
function applyLaneEmphasis() {
  const a = 0.15 + 0.85 * state.stp, m = 0.15 + 0.85 * (1 - state.stp);
  laneMats.auto.forEach((x) => (x.opacity = a));
  laneMats.manual.forEach((x) => (x.opacity = m));
  for (const { mesh, edges, node } of Object.values(nodeMeshes)) {
    const o = node.lane === "auto" ? a : node.lane === "manual" ? m : 1;
    mesh.material.opacity = 0.35 + 0.65 * o;
    edges.material.opacity = o;
  }
  labels.forEach((l) => {
    const lane = NODES[l.id].lane;
    l.el.style.opacity = lane === "auto" ? 0.35 + 0.65 * a : lane === "manual" ? 0.35 + 0.65 * m : 1;
  });
}

// ---------- labels, sizing, HUD ----------
const v = new THREE.Vector3();
function placeLabels(w, h) {
  for (const l of labels) {
    v.copy(l.pos).project(camera);
    l.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    l.el.hidden = v.z > 1;
  }
}

// Frame the whole flow. Wide screens look across it (left to right); tall screens
// look along it from behind the sources, so the flow runs up the screen.
let userMoved = false;
controls.addEventListener("start", () => { userMoved = true; });
function fitCamera(aspect) {
  const HALF_X = 15.5, HALF_Z = 7.5, t = controls.target;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  if (aspect >= 1) {
    const el = THREE.MathUtils.degToRad(50);
    const dist = Math.max(HALF_X / (tanV * aspect), (HALF_Z * 1.05) / tanV);
    camera.position.set(t.x, t.y + dist * Math.sin(el), t.z + dist * Math.cos(el));
  } else {
    const el = THREE.MathUtils.degToRad(58);
    const dist = Math.max(HALF_Z / (tanV * aspect), (HALF_X * Math.sin(el) * 1.15) / tanV);
    camera.position.set(t.x - dist * Math.cos(el), t.y + dist * Math.sin(el), t.z);
  }
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 50 : 38;
  camera.updateProjectionMatrix();
  if (!userMoved) fitCamera(w / h);
}
new ResizeObserver(resize).observe(stage);
resize();

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

// "Play the journey": 0% to 99.9% over a few seconds
let journey = null;
$("wf-journey").addEventListener("click", () => {
  reset();
  journey = { t: 0, hold: 5, ramp: 9 };
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
  for (let i = 0; i < 240; i++) step(1 / 30); // show a settled frame instead of an empty one
}
applyLaneEmphasis();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.playing) { runJourney(dt); step(dt); }
  controls.update();
  drawParticles();
  renderer.render(scene, camera);
  placeLabels(stage.clientWidth, stage.clientHeight);
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
