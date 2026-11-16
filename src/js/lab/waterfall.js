// 3D distribution waterfall. Deal proceeds pour from the top step down four tiers:
// return of capital, preferred return, catch-up, and the carried-interest split.
// Each tier drains into two glass tanks, one for investors and one for the manager.
//
// The picture is a pure function of the year on the scrubber: every frame asks
// waterfall-math.js for the state at that moment and draws it. Nothing accumulates,
// so scrubbing backwards or changing terms mid-way always shows the right answer.
//
// How to extend this file:
//   TERMS   the four deals and the default hurdle and carry
//   LAYOUT  where the steps, basins, deal columns and tanks sit
//   SCALE   how dollars map to heights
// The maths lives in waterfall-math.js.

import { createStage, THREE, LOOK, glow } from "/js/lab/stage.js";
import { european, american, clawback } from "/js/lab/waterfall-math.js";

const TERMS = {
  hurdle: 0.08, carry: 0.2,
  deals: [ // invested is in $M; multiple is proceeds / invested; year is the exit year
    { name: "Deal A", invested: 25, multiple: 2.5, year: 2 },
    { name: "Deal B", invested: 25, multiple: 0.4, year: 3 },
    { name: "Deal C", invested: 25, multiple: 3.0, year: 4 },
    { name: "Deal D", invested: 25, multiple: 1.2, year: 5 },
  ],
};
const TIERS = ["Return of capital", "Preferred return", "Catch-up", "Carry split"];
const POUR_YEARS = 0.9;      // how long one exit takes to pour, in scrubber years
const END_YEAR = 6.5;
const YEARS_PER_SECOND = 0.42;

const LAYOUT = {
  step: { x0: -5.5, dx: 4.3, yTop0: 7.4, dy: 2.3, depth: 7 }, // tier k basin sits at x0 + k*dx, on a step yTop0 - k*dy high
  basin: { w: 3.5, h: 1.15 },
  dealZ: [-2.55, -0.85, 0.85, 2.55],  // one lane per deal, also the four cascades in American style
  shelf: { x: -10.6, y: 10.2, w: 3.4 },
  tanks: { lp: { x: 12.8, z: -2.1 }, gp: { x: 12.8, z: 2.1 }, radius: 1.5, height: 9.4 }, // past the last step, so nothing hides the tiers
};
const SCALE = { tank: 0.026, deal: 0.034 }; // scene units per $M

const stageEl = document.getElementById("wt-stage");
const st = createStage({
  stageEl, canvas: document.getElementById("wt-canvas"), labelEl: document.getElementById("wt-labels"),
  target: [1, 5, 0], halfWidth: 15.5, halfHeight: 8.5, elevation: 18, azimuth: 16,
});
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = LAYOUT.step, B = LAYOUT.basin;
const tierX = (k) => S.x0 + k * S.dx;
const tierY = (k) => S.yTop0 - k * S.dy; // top of the step = bottom of the basin

// ---------- the staircase ----------
const shelf = st.solid(new THREE.BoxGeometry(LAYOUT.shelf.w, LAYOUT.shelf.y, S.depth));
shelf.mesh.position.set(LAYOUT.shelf.x, LAYOUT.shelf.y / 2, 0);
for (let k = 0; k < 4; k++) {
  const step = st.solid(new THREE.BoxGeometry(S.dx, tierY(k), S.depth));
  step.mesh.position.set(tierX(k), tierY(k) / 2, 0);
}

// ---------- deal columns on the top step: height = proceeds not yet distributed ----------
const dealColumns = TERMS.deals.map((d, i) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2dcae, emissive: 0xe2ad62, emissiveIntensity: 0.35, roughness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1.1), mat);
  mesh.position.set(LAYOUT.shelf.x, LAYOUT.shelf.y, LAYOUT.dealZ[i]);
  st.scene.add(mesh);
  const label = st.addLabel(d.name, "", V(LAYOUT.shelf.x, LAYOUT.shelf.y + 0.4, LAYOUT.dealZ[i]), "wt-deal");
  return { mesh, label };
});

// ---------- basins ----------
// One cascade is four basins. European style uses a single wide cascade; American
// style uses four narrow ones, one per deal. Both are built once and shown or hidden.
const LIQUID = {
  lp: new THREE.MeshStandardMaterial({ color: LOOK.teal, emissive: LOOK.teal, emissiveIntensity: 0.25, roughness: 0.25, transparent: true, opacity: 0.9 }),
  gp: new THREE.MeshStandardMaterial({ color: LOOK.gold, emissive: LOOK.gold, emissiveIntensity: 0.3, roughness: 0.25, transparent: true, opacity: 0.9 }),
};
function buildCascade(zCenter, depth) {
  const group = new THREE.Group();
  const basins = [];
  for (let k = 0; k < 4; k++) {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(B.w, B.h, depth),
      new THREE.MeshStandardMaterial({ color: 0xd9c9a8, transparent: true, opacity: 0.07, depthWrite: false })
    );
    glass.position.set(tierX(k), tierY(k) + B.h / 2, zCenter);
    glass.add(new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: LOOK.edge, transparent: true, opacity: 0.8 })));
    group.add(glass);
    // two liquids per basin: the investors' share and the manager's share, side by side in depth
    const liquid = (mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); group.add(m); return m; };
    basins.push({ k, z: zCenter, depth, lp: liquid(LIQUID.lp), gp: liquid(LIQUID.gp) });
  }
  st.scene.add(group);
  return { group, basins, z: zCenter, depth };
}
const cascades = {
  european: [buildCascade(0, 6.4)],
  american: LAYOUT.dealZ.map((z) => buildCascade(z, 1.3)),
};

// How a tier's money is shared: tiers 1 and 2 all to investors, tier 3 all to the manager, tier 4 split by carry.
const gpShare = (k, carry) => (k === 2 ? 1 : k === 3 ? carry : 0);

function drawBasin(b, amount, cap, carry) {
  const fill = cap === null ? Math.min(1, amount / 60) : cap > 0 ? Math.min(1, amount / cap) : 0;
  const h = Math.max(0.001, fill * (B.h - 0.08));
  const g = gpShare(b.k, carry), inner = b.depth - 0.08, y = tierY(b.k) + 0.02 + h / 2;
  const place = (mesh, share, zStart) => {
    mesh.visible = share > 0 && fill > 0;
    mesh.scale.set(B.w - 0.08, h, Math.max(0.001, inner * share));
    mesh.position.set(tierX(b.k), y, b.z - inner / 2 + zStart * inner + (inner * share) / 2);
  };
  place(b.lp, 1 - g, 0);
  place(b.gp, g, 1 - g);
}

// ---------- tanks ----------
const TK = LAYOUT.tanks;
function buildTank(pos, material, name) {
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(TK.radius, TK.radius, TK.height, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xd9c9a8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })
  );
  glass.position.set(pos.x, TK.height / 2, pos.z);
  st.scene.add(glass);
  for (const y of [0.02, TK.height]) { // rims
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TK.radius, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: LOOK.edge }));
    rim.rotation.x = Math.PI / 2; rim.position.set(pos.x, y, pos.z);
    st.scene.add(rim);
  }
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(TK.radius - 0.06, TK.radius - 0.06, 1, 40), material);
  st.scene.add(liquid);
  // the two tanks stand close together, so stagger their labels in height
  const label = st.addLabel(name, "$0M", V(pos.x, TK.height + (pos.z < 0 ? 2.1 : 0.5), pos.z), "wt-tank");
  return { pos, liquid, label };
}
const tanks = {
  lp: buildTank(TK.lp, LIQUID.lp, "Investors (LPs)"),
  gp: buildTank(TK.gp, LIQUID.gp, "Manager (GP)"),
};
function drawTank(tank, amount) {
  const h = Math.max(0.001, Math.min(TK.height - 0.1, amount * SCALE.tank));
  tank.liquid.scale.y = h;
  tank.liquid.position.set(tank.pos.x, h / 2 + 0.02, tank.pos.z);
  tank.liquid.visible = amount > 0.01;
}

const tierLabels = TIERS.map((name, k) => st.addLabel(`${k + 1} · ${name}`, "", V(tierX(k), tierY(k) + B.h + 0.5, -S.depth / 2), "wt-tier"));

// ---------- streams ----------
// Curves are cached by key because many particles share the same route.
const curveCache = new Map();
const cached = (key, make) => { if (!curveCache.has(key)) curveCache.set(key, new THREE.CatmullRomCurve3(make(), false, "catmullrom", 0.4)); return curveCache.get(key); };
// From a deal column, over each full basin's lip, into basin k of a cascade.
function inflowCurve(style, c, deal, k) {
  return cached(`in-${style}-${c}-${deal}-${k}`, () => {
    const z = cascades[style][c].z, dz = LAYOUT.dealZ[deal];
    const pts = [V(LAYOUT.shelf.x + 0.3, LAYOUT.shelf.y + 0.5, dz), V(LAYOUT.shelf.x + LAYOUT.shelf.w / 2 + 0.5, LAYOUT.shelf.y + 0.2, (dz + z) / 2)];
    for (let j = 0; j <= k; j++) {
      if (j > 0) pts.push(V(tierX(j - 1) + B.w / 2 + 0.3, tierY(j - 1) + B.h + 0.3, z));
      pts.push(V(tierX(j) + (j === k ? 0 : 0.6), tierY(j) + B.h * (j === k ? 0.5 : 1.05), z));
    }
    return pts;
  });
}
// From basin k, arcing over the lower steps, down into a tank.
function outflowCurve(style, c, k, who) {
  return cached(`out-${style}-${c}-${k}-${who}`, () => {
    const cas = cascades[style][c], t = TK[who];
    const start = V(tierX(k), tierY(k) + B.h * 0.6, cas.z);
    const entry = Math.max(0.6, Math.min(TK.height - 0.4, start.y - 0.4));
    return [start, V(tierX(k) + 1.2, start.y + 1.5, (cas.z + t.z) / 2), V((start.x + t.x) / 2 + 1, start.y + 2.4, t.z), V(t.x - 0.4, entry + 1.6, t.z), V(t.x, entry, t.z)];
  });
}

const MAX_DROPS = 1400;
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_DROPS);
drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
drops.count = 0; drops.frustumCulled = false;
st.scene.add(drops);
const DROP = { cash: glow(0xfff0cf, 1.5), lp: glow(LOOK.teal, 1.7), gp: glow(LOOK.gold, 1.9) };
let live = [];

function spawnDrops(dt, style, state, carry) {
  state.cascades.forEach((cas, c) => {
    if (cas.flowTier < 0) return;
    const n = Math.random() < 90 * dt ? 2 : 0; // about 90 pairs a second while a deal is pouring
    for (let i = 0; i < n && live.length < MAX_DROPS; i++) {
      const who = Math.random() < gpShare(cas.flowTier, carry) ? "gp" : "lp";
      live.push({
        curve: inflowCurve(style, c, cas.activeDeal, cas.flowTier), u: 0, speed: 9, color: DROP.cash,
        jitter: (Math.random() - 0.5) * cascades[style][c].depth * 0.6,
        next: { curve: outflowCurve(style, c, cas.flowTier, who), color: DROP[who] },
      });
    }
  });
}
const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3();
function moveDrops(dt) {
  const keep = [];
  for (const d of live) {
    d.u += (d.speed * dt) / d.curve.getLength();
    if (d.u >= 1) {
      if (!d.next) continue;
      Object.assign(d, { curve: d.next.curve, color: d.next.color, u: 0, speed: 7, jitter: 0, next: null });
    }
    keep.push(d);
  }
  live = keep;
  drops.count = live.length;
  live.forEach((d, i) => {
    d.curve.getPointAt(d.u, p3);
    m4.makeTranslation(p3.x, p3.y, p3.z + d.jitter * Math.min(1, d.u * 3));
    drops.setMatrixAt(i, m4);
    drops.setColorAt(i, d.color);
  });
  drops.instanceMatrix.needsUpdate = true;
  if (drops.instanceColor) drops.instanceColor.needsUpdate = true;
}

// ---------- state and drawing ----------
const ui = { style: "european", year: 0, playing: !st.reducedMotion };
const $ = (id) => document.getElementById(id);
const money = (x) => "$" + (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)) + "M";
const compute = (t) => (ui.style === "european" ? european(TERMS, t, POUR_YEARS) : american(TERMS, t, POUR_YEARS));

function draw(state) {
  for (const style of ["european", "american"]) cascades[style].forEach((c) => (c.group.visible = style === ui.style));
  const sums = TIERS.map(() => ({ amt: 0, cap: 0 }));
  state.cascades.forEach((cas, c) => {
    cascades[ui.style][c].basins.forEach((b, k) => {
      drawBasin(b, cas.tier[k], cas.cap[k], TERMS.carry);
      sums[k].amt += cas.tier[k]; sums[k].cap += cas.cap[k] || 0;
    });
  });
  tierLabels.forEach((l, k) => l.set(`${k + 1} · ${TIERS[k]}`, k < 3 ? `${money(sums[k].amt)} of ${money(sums[k].cap)}` : money(sums[k].amt)));
  dealColumns.forEach(({ mesh, label }, i) => {
    const d = TERMS.deals[i], h = Math.max(0.02, state.remaining[i] * SCALE.deal);
    mesh.scale.y = h; mesh.position.y = LAYOUT.shelf.y + h / 2;
    label.pos.y = LAYOUT.shelf.y + h + 0.4;
    label.set(`${d.name.replace("Deal ", "")} · ${d.multiple.toFixed(1)}×`, "");
  });
  drawTank(tanks.lp, state.lp); drawTank(tanks.gp, state.gp);
  tanks.lp.label.set("Investors (LPs)", money(state.lp));
  tanks.gp.label.set("Manager (GP)", money(state.gp) + " carry");

  $("wt-year-out").textContent = "Year " + ui.year.toFixed(1);
  $("wt-lp").textContent = money(state.lp);
  $("wt-gp").textContent = money(state.gp);
  const owed = european(TERMS, 99).gp, back = clawback(TERMS);
  $("wt-entitled").textContent = money(owed);
  $("wt-claw").textContent = ui.style === "american" ? money(back) : "none";
  $("wt-claw").classList.toggle("wf-hot", ui.style === "american" && back > 0.05);
}

// ---------- controls ----------
function setStyle(style) {
  ui.style = style; live = [];
  document.querySelectorAll("[data-wt-style]").forEach((b) => b.classList.toggle("active", b.dataset.wtStyle === style));
  $("wt-style-note").textContent = style === "european"
    ? "Whole fund: the manager is paid carry only after investors have all capital and the preferred return back."
    : "Deal by deal: the manager is paid carry on each winning deal as it exits, before later losses are known.";
}
document.querySelectorAll("[data-wt-style]").forEach((b) => b.addEventListener("click", () => setStyle(b.dataset.wtStyle)));

$("wt-year").addEventListener("input", (e) => { ui.year = +e.target.value; ui.playing = false; $("wt-play").textContent = "Play"; live = []; });
$("wt-play").addEventListener("click", () => {
  if (!ui.playing && ui.year >= END_YEAR) ui.year = 0;
  ui.playing = !ui.playing;
  $("wt-play").textContent = ui.playing ? "Pause" : "Play";
});
$("wt-replay").addEventListener("click", () => { ui.year = 0; live = []; ui.playing = true; $("wt-play").textContent = "Pause"; });

const bind = (id, out, apply, fmt) => {
  const show = () => ($(out).textContent = fmt(+$(id).value));
  $(id).addEventListener("input", () => { apply(+$(id).value); show(); });
  show();
};
bind("wt-hurdle", "wt-hurdle-out", (v) => (TERMS.hurdle = v / 100), (v) => v.toFixed(1) + "%");
bind("wt-carry", "wt-carry-out", (v) => (TERMS.carry = v / 100), (v) => v.toFixed(0) + "%");
TERMS.deals.forEach((d, i) => bind(`wt-deal-${i}`, `wt-deal-${i}-out`, (v) => (d.multiple = v), (v) => v.toFixed(1) + "×"));

const VIEWS = {
  tiers: { pos: V(-1, 9.5, 16), target: V(1.5, 4.5, 0) },
  tanks: { pos: V(22, 9, 12), target: V(11, 4, 0) },
  top: { pos: V(-18, 17, 8), target: V(-2, 6.5, 0) },
};
document.querySelectorAll("[data-wt-view]").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.wtView === "overview") st.flyHome(); else st.flyTo(VIEWS[b.dataset.wtView]);
}));
$("wt-orbit").addEventListener("click", () => st.setOrbit(!st.isOrbiting()));
st.onOrbitChange((on) => $("wt-orbit").classList.toggle("active", on));
$("wt-orbit").classList.toggle("active", st.isOrbiting());

// ---------- run ----------
setStyle("european");
if (st.reducedMotion) { ui.year = END_YEAR; $("wt-play").textContent = "Play"; } // show the finished fund instead of an empty one
st.start((dt) => {
  if (ui.playing) {
    ui.year = Math.min(END_YEAR, ui.year + dt * YEARS_PER_SECOND);
    if (ui.year >= END_YEAR) { ui.playing = false; $("wt-play").textContent = "Play"; }
  }
  $("wt-year").value = ui.year;
  const state = compute(ui.year);
  if (ui.playing) spawnDrops(dt, ui.style, state, TERMS.carry);
  moveDrops(dt);
  draw(state);
});
