// Pipeline race. Two tracks carry the same table from a source store to a target store.
//   Front track (row at a time): single records hop from pile to pile through six step
//   gates. Each pile between two gates is a staging table: written in full, then read back.
//   Back track (columnar): the plan gate drops the unneeded columns, then tall column
//   batches run through the same six steps in parallel lanes without stopping.
//
// How to extend this file:
//   MODEL   (pipeline-race-model.js) the timing formula and its ILLUSTRATIVE constants
//   LAYOUT  where everything sits in space (x = flow, y = height, z = depth)
//   PLAY    how simulated time is played back on screen
//   VISUAL  sizes, counts and speeds of the moving data (decoration, not timing)
// Timing always comes from MODEL. The moving blocks only illustrate it: their number and
// speed on screen are not a count of rows.

import { createStage, THREE, LOOK, glow } from "/js/lab/stage.js";
import { MODEL, rowJob, columnarJob, rowProgress, columnarProgress } from "/js/lab/pipeline-race-model.js";

const STEPS = MODEL.steps.length;

const LAYOUT = {
  x0: -16.8, pitch: 2.8,   // 13 slots along x: piles on even slots, step gates on odd slots
  rowZ: 6,                 // depth of the row track (front)
  colZ: -4.5,              // centre depth of the columnar track (back)
  gateY: 5.2,              // height at which a record passes through a step gate
  gateRadius: 0.8,
  laneWidth: 8,            // depth available to the parallel lanes
  slabHeight: 6.5,          // height of a full column of data
};

const PLAY = {
  planWall: 1.6,   // seconds on screen for the columnar plan step
  leadWall: 6,     // seconds on screen for the columnar track's work
  restWall: 12,    // seconds on screen for whatever the row track still has to do after that
};

const VISUAL = {
  pile: { perLayer: 3, layers: 16, dx: 0.42, dy: 0.26 },      // a full pile is 48 records
  record: { x: 0.34, y: 0.2, z: 1.1 },
  hop: { travel: 2.0, gap: 0.5, fastForward: 2.2 },           // seconds per hop, seconds between records
  maxColumns: 16,                                             // columns drawn, whatever the table has
  batchesPerLane: 5,
  slab: { x: 0.16, pitch: 0.26, loose: 0.28 },                 // loose = size of a single value when not vectorised
  laneSpeed: { vectorised: 9, loose: 4 },                     // scene units per second
};

const COLOR = {
  record: glow(LOOK.steel, 0.8), recordMoving: glow(LOOK.steel, 2.1), recordTarget: glow(LOOK.steel, 1.25),
  recordRead: glow(LOOK.steel, 0.26),                       // already read: the table stays, dimmed
  needed: glow(LOOK.gold, 1.15), neededHot: glow(LOOK.gold, 1.9), neededRead: glow(LOOK.gold, 0.24),
  unneeded: new THREE.Color(0x3d4a48), unneededRead: new THREE.Color(0x1f2625), unneededMoving: glow(LOOK.teal, 0.9),
};

// ---------- stage ----------
const $ = (id) => document.getElementById(id);
// The scene is long. On a tall, narrow stage, look along the tracks so they still fill the frame.
const portrait = $("pr-stage").clientWidth < $("pr-stage").clientHeight;
const st = createStage({
  stageEl: $("pr-stage"), canvas: $("pr-canvas"), labelEl: $("pr-labels"),
  target: [0, 2.6, 0.5], halfHeight: 7, elevation: 24,
  ...(portrait ? { halfWidth: 13, azimuth: -64 } : { halfWidth: 20.5, azimuth: -14 }),
});
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const slotX = (i) => LAYOUT.x0 + LAYOUT.pitch * i;
const pileX = (p) => slotX(p * 2);       // p = 0 source, 1..5 staging, 6 target
const gateX = (s) => slotX(s * 2 + 1);   // s = step index
const smooth = (k) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

// ---------- row track structures ----------
const RZ = LAYOUT.rowZ;
for (let p = 0; p <= STEPS; p++) {       // a tray under every pile
  const tray = st.solid(new THREE.BoxGeometry(1.7, 0.2, 1.7), { color: 0x2c333b });
  tray.mesh.position.set(pileX(p), 0.1, RZ);
  tray.edgeMat.color.set(LOOK.steel);
}
// A step gate is a ring on a mast. It flashes while a record pays its per-row overhead.
const gates = MODEL.steps.map((name, s) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a3138, emissive: LOOK.steel, emissiveIntensity: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(LAYOUT.gateRadius, 0.07, 10, 48), mat);
  ring.position.set(gateX(s), LAYOUT.gateY, RZ);
  ring.rotation.y = Math.PI / 2;
  st.scene.add(ring);
  const mastH = LAYOUT.gateY - LAYOUT.gateRadius;
  const mast = st.solid(new THREE.CylinderGeometry(0.06, 0.06, mastH, 8), { color: 0x4a5560 });
  mast.mesh.position.set(gateX(s), mastH / 2, RZ);
  st.addLabel(name, "", V(gateX(s), LAYOUT.gateY + LAYOUT.gateRadius + 0.2, RZ), "wf-label-layer pr-row");
  return mat;
});
st.addLabel("Staging table", "written, then read back", V(pileX(2), 0.1, RZ + 2.2), "pr-row");
const rowTitle = st.addLabel("Row-at-a-time ETL job", "", V(3, 0.1, RZ + 3.6), "wf-label-title pr-row");

// ---------- columnar track structures ----------
const CZ = LAYOUT.colZ;
const deckX0 = slotX(1) - 0.6, deckX1 = slotX(11) + 0.6;
const deck = st.solid(new THREE.BoxGeometry(deckX1 - deckX0, 0.3, LAYOUT.laneWidth + 1.2));
deck.mesh.position.set((deckX0 + deckX1) / 2, 0.15, CZ);

// A thin frame across all lanes. Used for the six fused steps and for the plan gate.
function frame(x, height, color, intensity) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a241c, emissive: color, emissiveIntensity: intensity });
  const half = LAYOUT.laneWidth / 2 + 0.5;
  const parts = [
    [0.08, height, 0.08, 0, height / 2, -half], [0.08, height, 0.08, 0, height / 2, half],
    [0.08, 0.08, half * 2, 0, height, 0],
  ];
  for (const [sx, sy, sz, dx, dy, dz] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x + dx, dy, CZ + dz);
    st.scene.add(m);
  }
  return mat;
}
const ribMats = MODEL.steps.map((_, s) => frame(gateX(s), LAYOUT.slabHeight + 0.8, LOOK.gold, 0.5));
const planX = slotX(0) + 1.5;
const planMat = frame(planX, LAYOUT.slabHeight + 1.6, LOOK.teal, 0.6);
const planLabel = st.addLabel("Query plan", "", V(planX, LAYOUT.slabHeight + 1.9, CZ + 3), "wf-auto");
const fusedLabel = st.addLabel("Six steps fused, no staging", "", V(slotX(5), LAYOUT.slabHeight + 1.1, CZ - LAYOUT.laneWidth / 2 - 0.5), "pr-col");
const colTitle = st.addLabel("Polars-style columnar engine", "", V(4, LAYOUT.slabHeight + 3.4, CZ), "wf-label-title pr-col");
st.addLabel("Source table", "same input for both", V(pileX(0), 0.1, (RZ + CZ) / 2 + 2.2));
st.addLabel("Target table", "", V(pileX(STEPS), 0.1, (RZ + CZ) / 2 + 2.2));

// ---------- moving data ----------
// Two instanced meshes of unit boxes, scaled per instance. Both are unlit and bright so they glow.
function instanced(max) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), max);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.setColorAt(0, COLOR.record); // allocate the colour buffer up front
  m.count = 0; m.frustumCulled = false;
  st.scene.add(m);
  return m;
}
const P = VISUAL.pile, pileCap = P.perLayer * P.layers;
const recordMesh = instanced((STEPS + 1) * pileCap + 16);
const slabMesh = instanced(VISUAL.maxColumns * (3 + 16 * VISUAL.batchesPerLane));

const dummy = new THREE.Object3D();
function put(mesh, x, y, z, sx, sy, sz, color, rotY = 0) {
  dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, rotY, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(mesh.count, dummy.matrix);
  mesh.setColorAt(mesh.count++, color);
}
function flush(mesh) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }

// ---------- state ----------
const ROW_CHOICES = [1, 1.5, 2, 3, 5, 7].flatMap((m) => [1e5, 1e6, 1e7].map((d) => m * d))
  .filter((n) => n <= 5e7).sort((a, b) => a - b);            // 100 thousand to 50 million, log spaced
const params = { rows: 1e7, cols: 40, needed: 6, cores: 8, prune: true, parallel: true, vectorised: true };
let row, col;                       // results of the timing model for the current params
const race = { mode: "ready", t: 0, speed: 0, restSpeed: 0, hopClock: 0, laneClock: 0, laneFade: 0, lastStep: 0 };

function recompute() {
  row = rowJob(params);
  col = columnarJob(params);
}

// Which drawn columns stand for the needed ones: spread evenly across the table.
function columnsDrawn() {
  const total = Math.min(params.cols, VISUAL.maxColumns);
  const needed = Math.max(1, Math.min(total, Math.round((params.needed / params.cols) * total)));
  const isNeeded = Array.from({ length: total }, (_, i) => Math.floor(((i + 1) * needed) / total) > Math.floor((i * needed) / total));
  return { total, needed, isNeeded };
}

// ---------- drawing the row track ----------
const rowsShare = (p) => (p > MODEL.filterStep ? MODEL.selectivity : 1); // piles after the filter hold fewer rows
function pileTop(count) { return 0.2 + Math.ceil(count / P.perLayer) * P.dy; }
// Draws `count` records; those from index `unread` up have already been read and are dimmed.
function drawPile(p, count, unread, color) {
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / P.perLayer), k = i % P.perLayer;
    put(recordMesh, pileX(p) + (k - 1) * P.dx, 0.2 + P.dy / 2 + layer * P.dy, RZ, VISUAL.record.x, VISUAL.record.y, VISUAL.record.z, i < unread ? color : COLOR.recordRead);
  }
}
function drawRowTrack(rp, running) {
  recordMesh.count = 0;
  const counts = [];
  for (let p = 0; p <= STEPS; p++) {
    const full = pileCap * rowsShare(p);
    // Written so far, and how much of that the next step has not read yet. Staging tables stay once written.
    const written = rp.done || p <= rp.step ? 1 : p === rp.step + 1 ? rp.frac : 0;
    const unread = rp.done ? (p === STEPS ? 1 : 0) : p < rp.step ? 0 : p === rp.step ? 1 - rp.frac : written;
    counts[p] = Math.round(full * written);
    drawPile(p, counts[p], Math.round(full * unread), p === STEPS ? COLOR.recordTarget : COLOR.record);
  }
  // Records in flight: lift off the pile, pass the gate (pause there for the per-row overhead), drop on the next pile.
  let atGate = 0;
  if (running && !rp.done) {
    const s = rp.step, H = VISUAL.hop, r = VISUAL.record;
    const ax = pileX(s), bx = pileX(s + 1), gx = gateX(s);
    const ay = pileTop(counts[s]), by = pileTop(counts[s + 1]);
    const first = Math.max(0, Math.ceil((race.hopClock - H.travel) / H.gap));
    for (let k = first; k * H.gap <= race.hopClock; k++) {
      const u = (race.hopClock - k * H.gap) / H.travel;
      let x, y, spin = 0;
      if (u < 0.18) { x = ax; y = ay + (LAYOUT.gateY - ay) * smooth(u / 0.18); }
      else if (u < 0.42) { x = ax + (gx - ax) * ((u - 0.18) / 0.24); y = LAYOUT.gateY; }
      else if (u < 0.6) { x = gx; y = LAYOUT.gateY; spin = ((u - 0.42) / 0.18) * Math.PI; atGate = 1; }
      else if (u < 0.82) { x = gx + (bx - gx) * ((u - 0.6) / 0.22); y = LAYOUT.gateY; }
      else { x = bx; y = LAYOUT.gateY + (by - LAYOUT.gateY) * smooth((u - 0.82) / 0.18); }
      put(recordMesh, x, y, RZ, r.x, r.y, r.z, COLOR.recordMoving, spin);
    }
  }
  gates.forEach((mat, s) => {
    const active = running && !rp.done && s === rp.step;
    mat.emissive.set(active && atGate ? LOOK.red : LOOK.steel);
    mat.emissiveIntensity = active ? (atGate ? 2.4 : 1.1) : 0.3;
  });
  flush(recordMesh);
}

// ---------- drawing the columnar track ----------
function drawColumnarTrack(progress, planShare, running) {
  slabMesh.count = 0;
  const cd = columnsDrawn(), H = LAYOUT.slabHeight;
  const spread = Math.min(0.5, LAYOUT.laneWidth / cd.total);
  const colZAt = (i) => CZ + (i - (cd.total - 1) / 2) * spread;

  // Source and target stores: one standing slab per column. Pruned columns sink during planning.
  for (let i = 0; i < cd.total; i++) {
    const keep = cd.isNeeded[i];
    const pruned = !keep && params.prune;
    const top = pruned ? H * (1 - smooth(planShare)) : H;   // pruned columns are never read
    const h = pruned ? top : H * (1 - progress);            // the part still to be read
    const w = spread * 0.7;
    if (h > 0.02) put(slabMesh, pileX(0), h / 2, colZAt(i), 0.9, h, w, keep ? (planShare > 0 ? COLOR.neededHot : COLOR.needed) : COLOR.unneeded);
    if (top - h > 0.02) put(slabMesh, pileX(0), (top + h) / 2, colZAt(i), 0.9, top - h, w, keep ? COLOR.neededRead : COLOR.unneededRead);
    const out = H * MODEL.selectivity * progress;
    if (keep && out > 0.02) put(slabMesh, pileX(STEPS), out / 2, colZAt(i), 0.9, out, spread * 0.7, COLOR.neededHot);
  }

  // Batches in flight. One lane per core; each batch is a cluster of column slabs.
  if (race.laneFade > 0.01) {
    const lanes = params.parallel ? params.cores : 1;
    const gap = Math.min(1.1, LAYOUT.laneWidth / lanes);
    const S = VISUAL.slab, x0 = planX + 0.4, x1 = pileX(STEPS) - 0.6, len = x1 - x0;
    const filterX = gateX(MODEL.filterStep);
    const columns = [];
    for (let i = 0; i < cd.total; i++) if (cd.isNeeded[i] || !params.prune) columns.push(cd.isNeeded[i]);
    for (let l = 0; l < lanes; l++) {
      const z = CZ + (l - (lanes - 1) / 2) * gap;
      for (let b = 0; b < VISUAL.batchesPerLane; b++) {
        const u = (race.laneClock / len + b / VISUAL.batchesPerLane + l * 0.37) % 1;
        const head = x0 + u * len;
        const ends = smooth(Math.min(u, 1 - u) * 10) * race.laneFade; // grow out of the plan gate, shrink into the target
        // With pushdown the filter has already run in the scan, so batches are short from the start.
        const kept = params.prune || head > filterX ? MODEL.selectivity : 1;
        const h = (params.vectorised ? H * kept : S.loose) * ends;
        if (h < 0.02) continue;
        columns.forEach((needed, c) => put(slabMesh, head - c * S.pitch, 0.3 + h / 2, z,
          params.vectorised ? S.x : S.loose * 0.4, h, Math.min(0.6, gap * 0.7), needed ? COLOR.neededHot : COLOR.unneededMoving));
      }
    }
  }
  planMat.emissiveIntensity = running && planShare > 0 && planShare < 1 ? 2.6 : 0.6;
  ribMats.forEach((m) => (m.emissiveIntensity = race.laneFade > 0.01 ? 0.5 + 1.1 * race.laneFade : 0.5));
  flush(slabMesh);
}

// ---------- readouts ----------
function fmtRows(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(Math.round(n));
}
function fmtTime(s) {
  if (s < 1) return Math.round(s * 1000) + " ms";
  if (s < 60) return s.toFixed(s < 10 ? 2 : 1) + " s";
  if (s < 3600) return Math.floor(s / 60) + " min " + Math.round(s % 60) + " s";
  return Math.floor(s / 3600) + " h " + Math.round((s % 3600) / 60) + " min";
}
const fmtRatio = (r) => "×" + (r >= 20 ? Math.round(r) : r.toFixed(1));
const fmtSpeed = (v) => (v >= 1 ? "×" + (v >= 10 ? Math.round(v) : v.toFixed(1)) : "×1/" + Math.round(1 / v));

function updateReadouts(rp, progress) {
  const stepName = MODEL.steps[rp.step];
  $("pr-row-rows").textContent = fmtRows(row.rowsIn[rp.step] * rp.frac);
  $("pr-row-step").textContent = rp.done ? "row track: finished, rows loaded" : `row track: rows through step ${rp.step + 1} of ${STEPS} (${stepName})`;
  $("pr-row-time").textContent = fmtTime(Math.min(race.t, row.total));
  $("pr-row-total").textContent = "row track: simulated time, of " + fmtTime(row.total);
  $("pr-col-rows").textContent = fmtRows(params.rows * progress);
  $("pr-col-time").textContent = fmtTime(Math.min(race.t, col.total));
  $("pr-col-total").textContent = "columnar track: simulated time, of " + fmtTime(col.total);
  $("pr-ratio").textContent = fmtRatio(row.total / col.total);

  rowTitle.set("Row-at-a-time ETL job", rp.done ? "finished in " + fmtTime(row.total) : `step ${rp.step + 1} of ${STEPS} · ${Math.floor(rp.share * 100)}% done`);
  colTitle.set("Polars-style columnar engine", progress >= 1 ? "finished in " + fmtTime(col.total) : race.t < col.plan ? "planning the query" : Math.floor(progress * 100) + "% done");
  $("pr-clock").textContent = race.mode === "ready" ? "Ready"
    : fmtTime(race.t) + " simulated" + (race.mode === "running" ? " · playback " + fmtSpeed(race.speed) : race.mode === "done" ? " · finished" : " · still frame");
}

// Text that only changes when a control changes.
function updateStatic() {
  const cd = columnsDrawn();
  $("pr-rows-out").textContent = fmtRows(params.rows);
  $("pr-cols-out").textContent = params.cols;
  $("pr-needed-out").textContent = params.needed + " of " + params.cols;
  $("pr-cores-out").textContent = params.cores;
  planLabel.set("Query plan", params.prune ? `read ${params.needed} of ${params.cols} columns, filter first` : "pruning off: read every column");
  const lanes = params.parallel ? params.cores : 1;
  fusedLabel.set("Six steps fused, no staging", `${lanes} ${lanes === 1 ? "core" : "cores"} · ${params.vectorised ? "whole column batches" : "one value at a time"}`);
  $("pr-canvas").dataset.columns = cd.needed + "/" + cd.total; // handy when testing

  const all = { ...params, prune: true, parallel: true, vectorised: true };
  const lines = [
    ["Row-at-a-time job", row.total],
    ["Columnar, all three advantages on", columnarJob(all).total],
    ["Columnar without pruning and pushdown", columnarJob({ ...all, prune: false }).total],
    ["Columnar without parallel cores", columnarJob({ ...all, parallel: false }).total],
    ["Columnar without vectorised batches", columnarJob({ ...all, vectorised: false }).total],
    ["Columnar with all three off (fused steps only)", columnarJob({ ...all, prune: false, parallel: false, vectorised: false }).total],
  ];
  $("pr-breakdown").replaceChildren(...lines.map(([name, t], i) => {
    const tr = document.createElement("tr");
    for (const text of [name, fmtTime(t), i === 0 ? "baseline" : fmtRatio(row.total / t) + " faster"]) {
      tr.appendChild(document.createElement("td")).textContent = text;
    }
    return tr;
  }));
}

// ---------- the race ----------
function draw() {
  const rp = rowProgress(row, race.t), progress = columnarProgress(col, race.t);
  const running = race.mode === "running";
  drawRowTrack(rp, running || race.mode === "still");
  drawColumnarTrack(progress, Math.min(1, race.t / col.plan), running);
  updateReadouts(rp, progress);
}

function setMode(mode) {
  race.mode = mode;
  $("pr-start").textContent = mode === "running" || mode === "done" ? "Restart the race" : "Start the race";
}
function resetRace() {
  recompute();
  Object.assign(race, { t: 0, speed: 0, restSpeed: 0, hopClock: 0, laneClock: 0, laneFade: 0, lastStep: 0 });
  updateStatic();
}
function startRace() { resetRace(); setMode("running"); }

// A still, populated frame for visitors who ask for reduced motion: the columnar track part way through.
function showStill() {
  resetRace();
  race.t = col.plan + col.exec * 0.6;
  race.hopClock = 1.3; race.laneFade = 1; race.laneClock = 3;
  setMode("still");
  draw();
}

// Simulated seconds per screen second. Slow while the columnar track works so it can be
// watched, then fast enough for the row track to finish in PLAY.restWall seconds.
function playbackSpeed() {
  if (race.t < col.plan) return col.plan / PLAY.planWall;
  const lead = col.exec / PLAY.leadWall;
  if (race.t < col.total) return lead;
  if (!race.restSpeed) race.restSpeed = Math.max(lead, (row.total - race.t) / PLAY.restWall);
  return race.restSpeed;
}

function update(dt) {
  if (race.mode !== "running") return;
  race.speed = playbackSpeed();
  race.t += dt * race.speed;

  const rp = rowProgress(row, race.t);
  if (rp.step !== race.lastStep) { race.lastStep = rp.step; race.hopClock = 0; } // a new step starts a new stream of records
  race.hopClock += dt * (race.restSpeed ? VISUAL.hop.fastForward : 1);

  const working = race.t >= col.plan && race.t < col.total;
  race.laneFade = Math.min(1, Math.max(0, race.laneFade + (working ? dt / 0.4 : -dt / 0.5)));
  race.laneClock += dt * (params.vectorised ? VISUAL.laneSpeed.vectorised : VISUAL.laneSpeed.loose);

  if (race.t >= Math.max(row.total, col.total) && race.laneFade === 0) setMode("done");
  draw();
}

// ---------- controls ----------
// Any change to the inputs restarts the race, so both tracks always run on the same settings.
function changed() { st.reducedMotion ? showStill() : startRace(); }

$("pr-rows").max = ROW_CHOICES.length - 1;
$("pr-rows").value = ROW_CHOICES.indexOf(params.rows);
$("pr-rows").addEventListener("input", (e) => { params.rows = ROW_CHOICES[+e.target.value]; changed(); });
$("pr-cols").addEventListener("input", (e) => {
  params.cols = +e.target.value;
  $("pr-needed").max = params.cols;                 // a query cannot need more columns than the table has
  params.needed = Math.min(params.needed, params.cols);
  changed();
});
$("pr-needed").addEventListener("input", (e) => { params.needed = +e.target.value; changed(); });
$("pr-cores").addEventListener("input", (e) => { params.cores = +e.target.value; changed(); });
for (const [id, key] of [["pr-t-prune", "prune"], ["pr-t-parallel", "parallel"], ["pr-t-vector", "vectorised"]]) {
  $(id).addEventListener("click", (e) => {
    params[key] = !params[key];
    e.currentTarget.classList.toggle("active", params[key]);
    e.currentTarget.setAttribute("aria-pressed", params[key]);
    changed();
  });
}
$("pr-start").addEventListener("click", startRace);

const VIEWS = {
  row: { pos: V(-7, 8, 25), target: V(0, 2.6, RZ) },
  columnar: { pos: V(-25, 10.5, 5), target: V(1, 2.2, CZ) },
};
document.querySelectorAll("[data-pr-view]").forEach((b) => b.addEventListener("click", () => {
  const view = VIEWS[b.dataset.prView];
  if (view) st.flyTo({ pos: view.pos.clone(), target: view.target.clone() }); else st.flyHome();
}));
$("pr-orbit").addEventListener("click", () => st.setOrbit(!st.isOrbiting()));
function showOrbit(on) { $("pr-orbit").classList.toggle("active", on); $("pr-orbit").setAttribute("aria-pressed", on); }
st.onOrbitChange(showOrbit);
showOrbit(st.isOrbiting());

// ---------- go ----------
if (st.reducedMotion) showStill(); else startRace();
st.start(update);
