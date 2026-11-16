// 3D career graph. Employers sit on a rising spiral (height = time); the domains,
// systems and results of each employer fan outward from it. Independent projects
// float inside the top of the spiral.
//
// How to extend this file:
//   career-graph-data.js   the nodes and edges (edit that file to change content)
//   CONFIG                 spiral shape, layout forces, sizes, colours, tour timing
// Below CONFIG: layout, scene objects, emphasis (hover/select/filter), panel and list, tour.

import { createStage, THREE, LOOK, glow } from "/js/lab/stage.js";
import { TIMELINE, TYPES, NODES, EDGES } from "/js/lab/career-graph-data.js";

const CONFIG = {
  seed: 20050701,                 // fixed, so the layout is identical on every visit
  spiral: { radius: 9.5, turns: 1.55, startAngle: 2.2, baseY: 2, yPerYear: 0.72 },
  layout: {
    iterations: 260,
    fan: 1.9,                     // how far each level (domain, system, result) sits outward from its employer
    rise: 0.7,                   // and how far upward
    jitter: 1.6,                  // seeded scatter of the starting positions
    repulsion: 0.8, spring: 0.1, restLength: 2.2, anchorPull: 0.12, minY: 1.1,
  },
  // level = how many steps a type sits away from its employer
  types: {
    employer: { color: LOOK.edge, css: "#C99A56", size: 0.62, level: 0 },
    domain:   { color: LOOK.teal, css: "#3E9E94", size: 0.42, level: 1 },
    system:   { color: LOOK.steel, css: "#7088A2", size: 0.4, level: 2 },
    result:   { color: 0xffc468, css: "#E0A030", size: 0.33, level: 3 },
    project:  { color: 0xa58be0, css: "#8B6FD0", size: 0.42, level: 1 },
  },
  dim: 0.1,                       // opacity of everything outside the highlighted neighbourhood
  edge: { radius: 0.024, opacity: 0.34, bow: 0.14 },
  pickRadiusPx: 24,               // how close a pointer must be to a node to hit it
  tour: { pause: 4.5, distance: 17, nodeDistance: 12 },
};

const $ = (id) => document.getElementById(id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- graph ----------
const nodes = NODES.map((n) => ({ ...n, groups: [].concat(n.type === "employer" ? n.id : n.group), links: [] }));
const byId = new Map(nodes.map((n) => [n.id, n]));
const edges = EDGES.map(([a, b]) => ({ a: byId.get(a), b: byId.get(b) }));
for (const e of edges) { e.a.links.push(e.b); e.b.links.push(e.a); }
const employers = nodes.filter((n) => n.type === "employer").sort((a, b) => a.from - b.from);

// ---------- layout ----------
const S = CONFIG.spiral;
function spiralPoint(year) {
  const t = (year - TIMELINE.from) / (TIMELINE.to - TIMELINE.from);
  const a = S.startAngle + t * S.turns * Math.PI * 2;
  return V(Math.cos(a) * S.radius, S.baseY + (year - TIMELINE.from) * S.yPerYear, Math.sin(a) * S.radius);
}
// mulberry32: a small seeded random number generator
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function layout() {
  const L = CONFIG.layout, rnd = seeded(CONFIG.seed);
  const anchors = new Map(employers.map((e) => [e.id, spiralPoint((e.from + e.to) / 2)]));
  // projects have no employer: they sit on the spiral's axis at the height of recent years
  anchors.set("projects", V(0, spiralPoint(TIMELINE.to).y - 1.5, 0));

  for (const n of nodes) {
    if (n.type === "employer") { n.pos = anchors.get(n.id); n.fixed = true; continue; }
    const anchor = V(0, 0, 0);
    n.groups.forEach((g) => anchor.add(anchors.get(g)));
    anchor.divideScalar(n.groups.length);
    const level = CONFIG.types[n.type].level;
    const out = V(anchor.x, 0, anchor.z);
    const onAxis = out.length() < 1;
    if (!onAxis) out.normalize().multiplyScalar(L.fan * level);
    else out.set(0, 0, 0);
    // home = where the node wants to be: outward and upward from its employer, further for each level
    n.home = anchor.clone().add(out).add(V(0, L.rise * level * (onAxis ? 1.6 : 1), 0));
    n.pos = n.home.clone().add(V((rnd() - 0.5) * 2 * L.jitter, (rnd() - 0.5) * L.jitter, (rnd() - 0.5) * 2 * L.jitter));
  }

  // light relaxation: nodes push apart, edges pull together, everything drifts toward home
  const d = V(0, 0, 0), force = new Map(nodes.map((n) => [n, V(0, 0, 0)]));
  for (let it = 0; it < L.iterations; it++) {
    const cool = 1 - it / L.iterations;
    force.forEach((f) => f.set(0, 0, 0));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        d.subVectors(nodes[i].pos, nodes[j].pos);
        const dist = Math.max(0.3, d.length());
        d.multiplyScalar(L.repulsion / (dist * dist * dist));
        force.get(nodes[i]).add(d); force.get(nodes[j]).sub(d);
      }
    }
    for (const e of edges) {
      d.subVectors(e.b.pos, e.a.pos);
      const dist = d.length() || 0.01;
      d.multiplyScalar(((dist - L.restLength) * L.spring) / dist);
      force.get(e.a).add(d); force.get(e.b).sub(d);
    }
    for (const n of nodes) {
      if (n.fixed) continue;
      const f = force.get(n);
      f.add(d.subVectors(n.home, n.pos).multiplyScalar(L.anchorPull));
      n.pos.add(f.clampLength(0, 0.6).multiplyScalar(0.4 + 0.6 * cool));
      n.pos.y = Math.max(L.minY, n.pos.y);
    }
  }
}
layout();

// ---------- stage ----------
const stageEl = $("cg-stage"), canvas = $("cg-canvas");
const topY = spiralPoint(TIMELINE.to).y;
const st = createStage({
  stageEl, canvas, labelEl: $("cg-labels"),
  target: [0, topY * 0.56, 0], halfWidth: S.radius + 7, halfHeight: topY * 0.78, elevation: 13, azimuth: -30,
});
st.scene.fog.density = 0.014; // a little thicker than the default so the far side of the spiral recedes

// ---------- timeline spiral ----------
function spiralTube(fromYear, toYear, radius, material) {
  const pts = [], steps = Math.max(8, Math.ceil((toYear - fromYear) * 8));
  for (let i = 0; i <= steps; i++) pts.push(spiralPoint(fromYear + ((toYear - fromYear) * i) / steps));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 3, radius, 6), material);
  st.scene.add(mesh);
}
spiralTube(TIMELINE.from, TIMELINE.to, 0.03, new THREE.MeshBasicMaterial({ color: 0x5a4a34, transparent: true, opacity: 0.7 }));
const tenureMat = new THREE.MeshBasicMaterial({ color: glow(LOOK.gold, 1.15), toneMapped: false, transparent: true, opacity: 0.8 });
for (const e of employers) spiralTube(e.from, e.to, 0.055, tenureMat);
const yearTags = [];
for (let y = TIMELINE.from; y <= TIMELINE.to; y += 5) {
  yearTags.push(st.addLabel(String(y), "", spiralPoint(y).add(V(0, -0.25, 0)), "cg-label-year"));
}
// a thin stem from each employer to the floor, so its height reads as a point in time
const stemMat = new THREE.LineBasicMaterial({ color: 0x6b5330, transparent: true, opacity: 0.45 });
for (const e of employers) {
  st.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([e.pos, V(e.pos.x, 0.02, e.pos.z)]), stemMat));
}

// ---------- nodes ----------
// Each type has its own shape. Results are unlit and brighter than the bloom threshold, so they glow.
const GEOMETRY = {
  employer: (s) => new THREE.BoxGeometry(s * 2, s * 2, s * 2),
  domain: (s) => new THREE.SphereGeometry(s, 24, 16),
  system: (s) => new THREE.OctahedronGeometry(s * 1.2),
  result: (s) => new THREE.IcosahedronGeometry(s, 1),
  project: (s) => new THREE.TorusGeometry(s, s * 0.34, 10, 28),
};
for (const n of nodes) {
  const T = CONFIG.types[n.type], geo = GEOMETRY[n.type](T.size);
  n.mats = []; // every material of this node, with its full opacity, for dimming
  if (n.type === "employer") {
    const s = st.solid(geo, { color: 0x3a2f20 });
    n.mesh = s.mesh;
    n.mesh.rotation.y = Math.PI / 4;
    n.mats.push({ mat: s.mat, base: 1 }, { mat: s.edgeMat, base: 0.95 });
  } else {
    const mat = n.type === "result"
      ? new THREE.MeshBasicMaterial({ color: glow(T.color, 1.9), toneMapped: false, transparent: true })
      : new THREE.MeshStandardMaterial({ color: T.color, emissive: T.color, emissiveIntensity: 0.3, roughness: 0.45, metalness: 0.1, flatShading: n.type === "system", transparent: true });
    n.mesh = new THREE.Mesh(geo, mat);
    if (n.type === "project") n.mesh.rotation.x = Math.PI / 2.6;
    st.scene.add(n.mesh);
    n.mats.push({ mat, base: 1 });
  }
  n.mesh.position.copy(n.pos);
  n.level = 1; // current emphasis, eased toward n.goal each frame
  n.goal = 1;
  const sub = n.type === "employer" ? n.years : "";
  n.tag = st.addLabel(n.label, sub, n.pos.clone().add(V(0, T.size + 0.45, 0)), "cg-label-" + n.type);
}

// ---------- edges ----------
// Each edge is a thin tube that bows away from the spiral's axis, so links read as arcs in space.
const EDGE_COLD = new THREE.Color(0x9a7a48), EDGE_HOT = glow(LOOK.gold, 1.7);
for (const e of edges) {
  const mid = e.a.pos.clone().add(e.b.pos).multiplyScalar(0.5);
  const len = e.a.pos.distanceTo(e.b.pos);
  const out = V(mid.x, 0, mid.z);
  if (out.length() > 0.5) out.normalize(); else out.set(0, 0, 0);
  mid.add(out.multiplyScalar(len * CONFIG.edge.bow)).add(V(0, len * CONFIG.edge.bow * 0.6, 0));
  const curve = new THREE.QuadraticBezierCurve3(e.a.pos, mid, e.b.pos);
  e.mat = new THREE.MeshBasicMaterial({ color: EDGE_COLD.clone(), toneMapped: false, transparent: true, opacity: CONFIG.edge.opacity, depthWrite: false });
  e.mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, CONFIG.edge.radius, 5), e.mat);
  e.heat = 0; e.heatGoal = 0; e.alpha = CONFIG.edge.opacity; e.alphaGoal = CONFIG.edge.opacity;
  st.scene.add(e.mesh);
}

// ---------- emphasis: hover, selection and filters ----------
const state = { hover: null, selected: null, hidden: new Set(), tour: null };
const isShown = (n) => !state.hidden.has(n.type);

// Decide what is bright, what is dim and which labels show. Called whenever state changes.
function refresh() {
  const focus = state.hover || state.selected;
  const near = focus ? new Set([focus, ...focus.links]) : null;
  // Employers are always labelled when nothing is focused. With a focus, only the focused node, its
  // neighbours and its own employer keep a label, so text never piles up.
  const labelled = focus ? new Set([...near, ...focus.groups.map((g) => byId.get(g))]) : new Set(employers);
  for (const n of nodes) {
    const shown = isShown(n), lit = !near || near.has(n);
    n.mesh.visible = shown;
    n.goal = lit ? 1 : CONFIG.dim;
    n.tag.el.hidden = !shown || !labelled.has(n);
    n.rank = n === focus ? 3 : lit ? 2 : 1; // which label wins when two would overlap
  }
  for (const e of edges) {
    const hot = focus && (e.a === focus || e.b === focus);
    e.mesh.visible = isShown(e.a) && isShown(e.b);
    e.heatGoal = hot ? 1 : 0;
    e.alphaGoal = hot ? 0.95 : focus ? CONFIG.edge.opacity * 0.18 : CONFIG.edge.opacity;
  }
}
function easeEmphasis(dt, elapsed) {
  const k = st.reducedMotion ? 1 : Math.min(1, dt * 9);
  for (const n of nodes) {
    n.level += (n.goal - n.level) * k;
    for (const m of n.mats) m.mat.opacity = m.base * n.level;
    if (n.type === "result" && !st.reducedMotion) n.mesh.scale.setScalar(1 + 0.1 * Math.sin(elapsed * 2.2 + n.pos.x));
    if (n === state.selected && !st.reducedMotion) n.mesh.rotation.y += dt * 0.9; // the selected node turns slowly
  }
  for (const e of edges) {
    e.heat += (e.heatGoal - e.heat) * k;
    e.alpha += (e.alphaGoal - e.alpha) * k;
    e.mat.color.lerpColors(EDGE_COLD, EDGE_HOT, e.heat);
    e.mat.opacity = e.alpha;
  }
}

// When two labels would overlap on screen, keep the more important one (then the nearer one) and fade the other.
const proj = new THREE.Vector3();
function declutter() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight, shown = [];
  const consider = (tag, rank) => {
    if (tag.el.hidden) return;
    if (!tag.w) { tag.w = tag.el.offsetWidth; tag.h = tag.el.offsetHeight; }
    proj.copy(tag.pos).project(st.camera);
    shown.push({ tag, rank, depth: proj.z, x: ((proj.x + 1) / 2) * w, y: ((1 - proj.y) / 2) * h });
  };
  nodes.forEach((n) => consider(n.tag, n.rank));
  yearTags.forEach((t) => consider(t, 0));
  shown.sort((a, b) => b.rank - a.rank || a.depth - b.depth);
  const kept = [];
  for (const s of shown) {
    const clash = kept.some((k) => Math.abs(k.x - s.x) < (k.tag.w + s.tag.w) / 2 + 4 && Math.abs(k.y - s.y) < Math.max(k.tag.h, s.tag.h) + 2);
    s.tag.el.classList.toggle("cg-label-clash", clash);
    if (!clash) kept.push(s);
  }
}

// ---------- picking ----------
// Nodes are small, so instead of ray-casting the meshes we take the node whose
// screen position is nearest the pointer. This also gives fingers a generous target.
function nodeAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = clientX - r.left, y = clientY - r.top;
  let best = null, bestD = CONFIG.pickRadiusPx;
  for (const n of nodes) {
    if (!isShown(n)) continue;
    proj.copy(n.pos).project(st.camera);
    if (proj.z > 1 || proj.z < -1) continue;
    const dpx = Math.hypot(((proj.x + 1) / 2) * r.width - x, ((1 - proj.y) / 2) * r.height - y);
    if (dpx < bestD) { bestD = dpx; best = n; }
  }
  return best;
}
let press = null;
canvas.addEventListener("pointerdown", (e) => { press = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" || e.buttons) return; // touch has no hover; a drag is an orbit
  const n = nodeAt(e.clientX, e.clientY);
  canvas.classList.toggle("cg-pointer", !!n);
  if (n !== state.hover) { state.hover = n; refresh(); }
});
canvas.addEventListener("pointerleave", () => { if (state.hover) { state.hover = null; refresh(); } });
canvas.addEventListener("pointerup", (e) => {
  if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) return; // it was a drag
  select(nodeAt(e.clientX, e.clientY));
});

// ---------- detail panel ----------
const detail = $("cg-detail");
function el(tag, className, text) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (text) x.textContent = text;
  return x;
}
function mark(type) {
  const m = el("i", "cg-mark cg-mark-" + type);
  m.style.setProperty("--c", CONFIG.types[type].css);
  return m;
}
function nodeButton(n) {
  const b = el("button");
  b.type = "button";
  b.dataset.cgNode = n.id;
  b.append(mark(n.type), n.label);
  b.addEventListener("click", () => { stopTour(); select(n, { fly: true, reveal: true }); });
  return b;
}
function renderDetail(n) {
  detail.replaceChildren();
  if (!n) {
    detail.append(
      el("h2", "", "Nothing selected"),
      el("p", "cg-note", "Click a node in the scene, start the tour, or choose an item from the list below."));
    return;
  }
  const type = el("div", "cg-type");
  type.append(mark(n.type), TYPES[n.type].one);
  detail.append(type, el("h2", "", n.label));
  const meta = [n.role, n.years].filter(Boolean).join(" · ");
  if (meta) detail.append(el("p", "cg-meta", meta));
  detail.append(el("p", "cg-note", n.note));
  if (n.link) {
    const a = el("a", "cg-case", "Read the case study →");
    a.href = n.link;
    detail.append(a);
  }
  const links = el("div", "cg-links");
  links.append(el("span", "", "Connected to"), ...n.links.map(nodeButton));
  detail.append(links);
}

// ---------- selection and camera ----------
// A camera position that looks at `n` from outside the spiral. Employers are framed with their whole cluster.
function viewFor(n) {
  const target = n.pos.clone();
  let dist = CONFIG.tour.nodeDistance;
  if (n.type === "employer") {
    const members = nodes.filter((m) => m.groups.length === 1 && m.groups[0] === n.id);
    const centre = V(0, 0, 0);
    members.forEach((m) => centre.add(m.pos));
    target.lerp(centre.divideScalar(members.length), 0.6);
    dist = CONFIG.tour.distance;
  }
  const out = V(target.x, 0, target.z);
  // nodes on the axis have no outward direction, so keep the side the camera is already on
  if (out.length() < 2) out.set(st.camera.position.x, 0, st.camera.position.z);
  out.normalize();
  return { pos: target.clone().add(out.multiplyScalar(dist)).add(V(0, dist * 0.22, 0)), target };
}
function select(n, { fly = false, reveal = false } = {}) {
  if (n && !isShown(n)) setTypeShown(n.type, true);
  state.selected = n || null;
  renderDetail(state.selected);
  document.querySelectorAll("#cg-groups [data-cg-node]").forEach((b) => {
    if (n && b.dataset.cgNode === n.id) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
  refresh();
  if (n && fly) { st.setOrbit(false); st.flyTo(viewFor(n)); }
  if (n && reveal) stageEl.scrollIntoView({ block: "nearest", behavior: st.reducedMotion ? "auto" : "smooth" });
}

// ---------- filters ----------
const filterButtons = {};
function setTypeShown(type, shown) {
  if (shown) state.hidden.delete(type); else state.hidden.add(type);
  filterButtons[type].setAttribute("aria-pressed", String(shown));
  if (state.selected && !isShown(state.selected)) select(null);
  if (state.hover && !isShown(state.hover)) state.hover = null;
  refresh();
}
for (const type of Object.keys(TYPES)) {
  const b = el("button", "cg-filter");
  b.type = "button";
  b.append(mark(type), TYPES[type].many);
  b.addEventListener("click", () => setTypeShown(type, state.hidden.has(type)));
  filterButtons[type] = b;
  $("cg-filters").append(b);
  setTypeShown(type, true);
}

// ---------- plain list (keyboard and screen-reader route to every node) ----------
const typeOrder = Object.keys(TYPES);
const listOrder = ["employer", "project", "domain", "system", "result"]; // the head of each group first
function listGroup(title, small, members) {
  const g = el("div", "cg-group"), h = el("h3", "", title), ul = el("ul");
  if (small) h.append(el("small", "", small));
  members.sort((a, b) => listOrder.indexOf(a.type) - listOrder.indexOf(b.type));
  for (const n of members) { const li = el("li"); li.append(nodeButton(n)); ul.append(li); }
  g.append(h, ul);
  $("cg-groups").append(g);
}
for (const e of employers) listGroup(e.label, e.years, nodes.filter((n) => n.groups.includes(e.id)));
listGroup("Independent projects", "", nodes.filter((n) => n.groups.includes("projects")));

// ---------- stats ----------
function stat(value, text) {
  const s = el("div", "wf-stat");
  s.append(el("b", "", String(value)), el("span", "", text));
  $("cg-stats").append(s);
}
const count = (type) => nodes.filter((n) => n.type === type).length;
stat(TIMELINE.to - TIMELINE.from, `years, ${TIMELINE.from} to today`);
stat(count("employer"), "employers");
stat(count("domain"), "business domains");
stat(count("system"), "systems and technologies");
stat(count("result"), "results");
stat(count("project"), "independent projects");

// ---------- tour: fly through the employers in order ----------
const tourBtn = $("cg-tour");
function tourStep(i) {
  state.tour = { i, wait: CONFIG.tour.pause };
  select(employers[i], { fly: true });
}
function startTour() {
  typeOrder.forEach((t) => setTypeShown(t, true));
  tourBtn.textContent = "Stop tour";
  tourBtn.classList.add("active");
  tourStep(0);
}
function stopTour() {
  if (!state.tour) return;
  state.tour = null;
  tourBtn.textContent = "Tour";
  tourBtn.classList.remove("active");
}
function runTour(dt) {
  if (!state.tour) return;
  state.tour.wait -= dt;
  if (state.tour.wait > 0) return;
  if (state.tour.i + 1 < employers.length) tourStep(state.tour.i + 1);
  else { stopTour(); st.flyHome(); }
}
tourBtn.addEventListener("click", () => (state.tour ? stopTour() : startTour()));
st.controls.addEventListener("start", stopTour); // grabbing the scene ends the tour

// ---------- camera buttons ----------
const orbitBtn = $("cg-orbit");
function showOrbit(on) { orbitBtn.classList.toggle("active", on); orbitBtn.setAttribute("aria-pressed", String(on)); }
st.onOrbitChange(showOrbit);
showOrbit(st.isOrbiting()); // off at load when the visitor prefers reduced motion
orbitBtn.addEventListener("click", () => st.setOrbit(!st.isOrbiting()));
$("cg-overview").addEventListener("click", () => { stopTour(); st.flyHome(); });

// ---------- go ----------
renderDetail(null);
refresh();
st.start((dt, elapsed) => { runTour(dt); easeEmphasis(dt, elapsed); declutter(); });
