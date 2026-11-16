// Capability city. A business capability map drawn as a city you can orbit.
// One plot per district, one building per capability.
//   height = relative operational volume
//   colour = automation level (manual, automated, agent-ready)
//
// How to extend this file:
//   capability-city-data.js  the districts and capabilities (edit the content there)
//   LEVELS                   the three automation levels and their colours
//   CITY                     sizes and spacing of plots and buildings
//   VIEWS                    which districts get a camera button (ids match data-cc-view in the page)
// Below those blocks: build the city, then state (today/target, filter, selection), then controls.

import { createStage, THREE, LOOK, glow } from "/js/lab/stage.js";
import { DISTRICTS } from "/js/lab/capability-city-data.js";

// `body` tints the building, `light` is the roof and floor strips. Brighter light = more glow,
// so manual buildings look unlit next to automated and agent-ready ones.
const LEVELS = {
  manual:    { label: "Manual",      hex: LOOK.steel, lightK: 1.0 },
  automated: { label: "Automated",   hex: LOOK.gold,  lightK: 1.7 },
  agent:     { label: "Agent-ready", hex: LOOK.teal,  lightK: 2.0 },
};

const CITY = {
  ringRadius: 10.8,     // distance from the hub plot to the plots around it
  plot: 8,              // plot side length
  plotHeight: 0.4,      // plots are raised slightly off the floor
  columns: 3,           // buildings per row on a plot
  cell: 2.45,           // spacing between building centres
  footprint: 1.75,      // largest building side; each building is a little narrower than this
  baseHeight: 0.8,      // height of a building with volume 0
  heightPerVolume: 0.72,
  floorGap: 0.85,       // vertical distance between glowing floor strips
  sunkHeight: 0.22,     // height of a building that the filter has hidden
  ease: 4.5,            // how fast colours and heights follow a change (higher = faster)
};

const VIEWS = ["treasury", "settlement", "accounting"];

// ---------- stage ----------
const $ = (id) => document.getElementById(id);
const st = createStage({
  stageEl: $("cc-stage"), canvas: $("cc-canvas"), labelEl: $("cc-labels"),
  target: [0, 2.2, 0], halfWidth: 17, halfHeight: 9.5, elevation: 30, azimuth: -28,
});

for (const level of Object.values(LEVELS)) {
  level.body = new THREE.Color(level.hex).lerp(new THREE.Color(LOOK.structure), 0.3);
  level.light = glow(level.hex, level.lightK);
}
const DIMMED = { body: new THREE.Color(0x221d17), light: new THREE.Color(0x3a3126) };

// ---------- build the city ----------
// The hub district sits in the middle, the rest go round it in the order listed in the data.
const ring = DISTRICTS.filter((d) => !d.hub);
const plotTop = CITY.plotHeight;
const buildings = [];
const districtCentre = {};

for (const d of DISTRICTS) {
  const i = ring.indexOf(d);
  const angle = (i / ring.length) * Math.PI * 2 + Math.PI / 6;
  const cx = d.hub ? 0 : Math.cos(angle) * CITY.ringRadius;
  const cz = d.hub ? 0 : Math.sin(angle) * CITY.ringRadius;
  districtCentre[d.id] = new THREE.Vector3(cx, 0, cz);

  const plot = st.solid(new THREE.BoxGeometry(CITY.plot, CITY.plotHeight, CITY.plot), { color: 0x241f18 });
  plot.mesh.position.set(cx, CITY.plotHeight / 2, cz);
  plot.edgeMat.opacity = 0.5;

  const rows = Math.ceil(d.capabilities.length / CITY.columns);
  let tallest = 0;
  d.capabilities.forEach((cap, n) => {
    const col = n % CITY.columns, row = Math.floor(n / CITY.columns);
    const inRow = Math.min(CITY.columns, d.capabilities.length - row * CITY.columns); // centre a short last row
    const k = buildings.length;
    const h = CITY.baseHeight + cap.volume * CITY.heightPerVolume;
    tallest = Math.max(tallest, h);
    buildings.push({
      cap, district: d, h,
      x: cx + (col - (inRow - 1) / 2) * CITY.cell,
      z: cz + (row - (rows - 1) / 2) * CITY.cell,
      // footprints vary a little so the skyline does not look like a bar chart
      w: CITY.footprint * (0.8 + 0.2 * ((k * 7) % 5) / 4),
      d: CITY.footprint * (0.8 + 0.2 * ((k * 3) % 4) / 3),
      strips: Math.floor((h - 0.35) / CITY.floorGap),
      up: st.reducedMotion ? 1 : 0, // 0 = sunk, 1 = full height; starts at 0 so the city rises on load
      body: DIMMED.body.clone(), light: DIMMED.light.clone(),
    });
  });
  st.addLabel(d.name, "", new THREE.Vector3(cx, plotTop + tallest + 1.5, cz), "wf-label-title");
}

// Three instanced meshes draw the whole city: bodies (lit), light strips and roofs (glowing).
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // origin at the base, so scale.y = height
const bodies = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.25 }), buildings.length);
const stripCount = buildings.reduce((n, b) => n + b.strips + 1, 0); // +1 for the roof
const strips = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ toneMapped: false }), stripCount);
for (const mesh of [bodies, strips]) {
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  st.scene.add(mesh);
}

// Selection marker: a bright wire box round the building and a beam above it.
const markerColor = glow(0xfff1dc, 1.6);
const marker = new THREE.LineSegments(new THREE.EdgesGeometry(unitBox), new THREE.LineBasicMaterial({ color: markerColor, toneMapped: false }));
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: markerColor, toneMapped: false }));
marker.visible = beam.visible = false;
st.scene.add(marker, beam);

const pinPos = new THREE.Vector3(), hoverPos = new THREE.Vector3();
const pinLabel = st.addLabel("", "", pinPos, "cc-label-pin");
const hoverLabel = st.addLabel("", "", hoverPos);
pinLabel.el.hidden = hoverLabel.el.hidden = true;

// ---------- state ----------
const state = { mode: "today", filter: "all", selected: null, hovered: null };
const levelOf = (b) => b.cap[state.mode];
const matches = (b) => state.filter === "all" || levelOf(b) === state.filter;
const heightNow = (b) => CITY.sunkHeight + (b.h - CITY.sunkHeight) * b.up;

// Each frame every building eases towards the colour and height its state asks for.
const m4 = new THREE.Matrix4(), tmpColor = new THREE.Color();
function box(mesh, i, x, y, z, w, h, d) {
  mesh.setMatrixAt(i, m4.makeScale(w, h, d).setPosition(x, y, z));
}
function update(dt) {
  const k = st.reducedMotion ? 1 : 1 - Math.exp(-dt * CITY.ease);
  let s = 0;
  buildings.forEach((b, i) => {
    const on = matches(b), look = on ? LEVELS[levelOf(b)] : DIMMED;
    b.up += ((on ? 1 : 0) - b.up) * k;
    b.body.lerp(look.body, k);
    b.light.lerp(look.light, k);
    const h = heightNow(b);

    box(bodies, i, b.x, plotTop, b.z, b.w, h, b.d);
    bodies.setColorAt(i, b.body);

    tmpColor.copy(b.light);
    if (b === state.selected) tmpColor.multiplyScalar(1.5);
    for (let f = 1; f <= b.strips; f++, s++) {
      const y = f * CITY.floorGap;
      const size = y < h - 0.3 ? 1 : 0; // strips above the current roof are hidden
      box(strips, s, b.x, plotTop + y, b.z, (b.w + 0.05) * size, 0.07 * size, (b.d + 0.05) * size);
      strips.setColorAt(s, tmpColor);
    }
    box(strips, s, b.x, plotTop + h, b.z, b.w * 0.72, 0.1, b.d * 0.72); // roof light
    strips.setColorAt(s++, tmpColor);
  });
  for (const mesh of [bodies, strips]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  const sel = state.selected;
  if (sel) {
    const h = heightNow(sel);
    marker.position.set(sel.x, plotTop, sel.z);
    marker.scale.set(sel.w + 0.22, h + 0.12, sel.d + 0.22);
    beam.position.set(sel.x, plotTop + h, sel.z);
    beam.scale.y = 2.2;
    pinPos.set(sel.x, plotTop + h + 2.4, sel.z);
  }
  if (state.hovered) hoverPos.set(state.hovered.x, plotTop + heightNow(state.hovered) + 0.5, state.hovered.z);
}

// ---------- panel, counters, controls ----------
function chip(level) {
  const el = document.createElement("span"), sw = document.createElement("i");
  el.className = "cc-chip";
  sw.className = "cc-swatch cc-" + level;
  el.append(sw, LEVELS[level].label);
  return el;
}
function showDetail() {
  const b = state.selected;
  marker.visible = beam.visible = !!b;
  pinLabel.el.hidden = !b;
  $("cc-pick").value = b ? String(buildings.indexOf(b)) : "";
  if (!b) return;
  const { cap } = b, changes = cap.today !== cap.target;
  pinLabel.set(cap.name, b.district.name);
  $("cc-d-name").textContent = cap.name;
  const meta = $("cc-d-meta");
  meta.replaceChildren(b.district.name, chip(cap.today));
  if (changes) meta.append("to", chip(cap.target), "in the target state");
  meta.append(`Relative volume ${cap.volume} of 10`);
  $("cc-d-what").textContent = cap.what;
  // In the target state, lead with what changes; today, with why it is where it is.
  const today = "Today: " + cap.why;
  const target = changes ? "Target: " + cap.next : "Target: no change. " + cap.why;
  $("cc-d-why").textContent = state.mode === "today" ? today + (changes ? " " + target : "") : target + (changes ? " " + today : "");
}
function select(b) {
  state.selected = b;
  showDetail();
}

function showCounts() {
  for (const level of Object.keys(LEVELS)) {
    $("cc-n-" + level).textContent = buildings.filter((b) => levelOf(b) === level).length;
  }
  $("cc-n-total").textContent = buildings.length;
  $("cc-n-caption").textContent = state.mode === "today" ? "capabilities, today" : "capabilities, target state";
}

// Segmented buttons: one handler for both the state toggle and the filter.
function segment(attr, key, after) {
  const buttons = document.querySelectorAll(`[${attr}]`);
  buttons.forEach((btn) => btn.addEventListener("click", () => {
    state[key] = btn.getAttribute(attr);
    buttons.forEach((o) => {
      o.classList.toggle("active", o === btn);
      o.setAttribute("aria-pressed", o === btn);
    });
    after();
  }));
}
segment("data-cc-mode", "mode", () => { showCounts(); showDetail(); });
segment("data-cc-filter", "filter", () => {});

// The list gives keyboard and screen-reader users the same selection as clicking a building.
const pick = $("cc-pick");
for (const d of DISTRICTS) {
  const group = document.createElement("optgroup");
  group.label = d.name;
  buildings.forEach((b, i) => { if (b.district === d) group.append(new Option(b.cap.name, i)); });
  pick.append(group);
}
pick.addEventListener("change", () => select(pick.value === "" ? null : buildings[+pick.value]));

// ---------- picking buildings in the scene ----------
const canvas = $("cc-canvas");
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
function buildingAt(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, st.camera);
  bodies.boundingSphere = null; // heights change, so the cached bounds would go stale
  const hit = raycaster.intersectObject(bodies)[0];
  return hit ? buildings[hit.instanceId] : null;
}
// A press that does not move is a click. The stage stops orbiting on any press, so remember
// whether it was orbiting (capture phase runs before the camera controls) and restore it after a click.
let press = null;
$("cc-stage").addEventListener("pointerdown", (e) => {
  if (e.target === canvas) press = { x: e.clientX, y: e.clientY, orbiting: st.isOrbiting() };
}, true);
canvas.addEventListener("pointerup", (e) => {
  if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) return;
  const b = buildingAt(e);
  if (b) select(b === state.selected ? null : b);
  if (press.orbiting) st.setOrbit(true);
  press = null;
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || e.buttons) return;
  const b = buildingAt(e);
  state.hovered = b && b !== state.selected ? b : null;
  hoverLabel.el.hidden = !state.hovered;
  if (state.hovered) hoverLabel.set(state.hovered.cap.name, "");
  canvas.style.cursor = b ? "pointer" : "";
});
canvas.addEventListener("pointerleave", () => { state.hovered = null; hoverLabel.el.hidden = true; });

// ---------- camera ----------
// A district view stands outside the city and looks in across that district's plot.
function districtView(id) {
  const c = districtCentre[id];
  const out = c.clone().setY(0).normalize();
  const dist = st.camera.aspect < 1 ? 19 : 13.5; // stand further back on a tall, narrow stage
  return {
    pos: c.clone().addScaledVector(out, dist).add(new THREE.Vector3(-out.z * 5, dist * 0.62, out.x * 5)),
    target: c.clone().setY(2.4),
  };
}
document.querySelectorAll("[data-cc-view]").forEach((btn) => {
  const id = btn.dataset.ccView;
  btn.addEventListener("click", () => {
    if (VIEWS.includes(id)) { st.setOrbit(false); st.flyTo(districtView(id)); } else st.flyHome();
  });
});
const orbitBtn = $("cc-orbit");
function showOrbit(on) {
  orbitBtn.classList.toggle("active", on);
  orbitBtn.setAttribute("aria-pressed", on);
}
orbitBtn.addEventListener("click", () => st.setOrbit(!st.isOrbiting()));
st.onOrbitChange(showOrbit);
showOrbit(st.isOrbiting());

// ---------- go ----------
showCounts();
update(0);
st.start(update);
