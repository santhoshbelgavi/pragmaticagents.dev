// Timing model for the pipeline race. No rendering code here, so it can be tested with node.
//
// Every constant in MODEL is ILLUSTRATIVE. They are chosen to show the mechanism
// (why per-row overhead, staging, unread columns and idle cores cost time). They are not
// benchmarks or measurements of any real system.
//
// The formulas, in full:
//
//   Both tracks run the same six steps in the same order. The filter keeps
//   `selectivity` of the rows, so steps after the filter see fewer rows.
//
//   Row-at-a-time job, for each step s:
//     work(s)    = rowsIn(s) * (rowOverheadNs + cols * rowValueNs)
//     staging(s) = rowsOut(s) * cols * stagingValueNs      (every step except the last)
//     total      = sum of work(s) + staging(s)
//
//   Columnar engine:
//     colsRead   = needed columns if pruning is on, otherwise all columns
//     rowsIn(s)  = with filter pushdown the filter runs inside the scan, so every step
//                  after the first sees only the kept rows; without it, same as the row job
//     work(s)    = vectorised:  rowsIn(s) * colsRead * vecValueNs + batches(s) * batchOverheadNs
//                  not vectorised: rowsIn(s) * (rowOverheadNs + colsRead * rowValueNs)
//     speedup    = 1 / (serialFraction + (1 - serialFraction) / cores)   (1 if parallel is off)
//     total      = planMs + sum of work(s) / speedup                     (no staging: steps are fused)

export const MODEL = {
  steps: ["Extract", "Cast types", "Join", "Filter", "Aggregate", "Load"],
  filterStep: 3,          // index of "Filter" in steps
  selectivity: 0.4,       // ILLUSTRATIVE share of rows the filter keeps
  rowOverheadNs: 250,     // ILLUSTRATIVE cost per row per step: function calls, type checks, allocation
  rowValueNs: 25,         // ILLUSTRATIVE cost per value when values are handled one at a time
  stagingValueNs: 30,     // ILLUSTRATIVE cost per value to write a step's result to staging and read it back
  vecValueNs: 8,          // ILLUSTRATIVE cost per value inside a tight loop over a whole column batch
  batchRows: 65536,       // rows per vectorised batch
  batchOverheadNs: 20000, // ILLUSTRATIVE cost to dispatch one batch
  serialFraction: 0.1,    // ILLUSTRATIVE share of the work that cannot be spread across cores
  planMs: 20,             // ILLUSTRATIVE one-off cost to optimise the query plan
};

const NS = 1e-9;

// Rows entering each step when the filter runs at its written position.
function rowsInOrder(rows) {
  return MODEL.steps.map((_, s) => (s <= MODEL.filterStep ? rows : rows * MODEL.selectivity));
}

// Row-at-a-time job. Returns seconds per step (work plus the staging write after it).
export function rowJob({ rows, cols }) {
  const rowsIn = rowsInOrder(rows);
  const last = MODEL.steps.length - 1;
  const stepSeconds = rowsIn.map((n, s) => {
    const rowsOut = s >= MODEL.filterStep ? rows * MODEL.selectivity : rows;
    const work = n * (MODEL.rowOverheadNs + cols * MODEL.rowValueNs);
    const staging = s < last ? rowsOut * cols * MODEL.stagingValueNs : 0;
    return (work + staging) * NS;
  });
  return { rowsIn, stepSeconds, total: stepSeconds.reduce((a, b) => a + b, 0) };
}

// Parallel speedup with imperfect scaling (Amdahl's law).
export function speedup(cores) {
  return 1 / (MODEL.serialFraction + (1 - MODEL.serialFraction) / cores);
}

// Columnar engine. The three flags are the advantages the visitor can switch off.
export function columnarJob({ rows, cols, needed, cores, prune, parallel, vectorised }) {
  const colsRead = prune ? Math.min(needed, cols) : cols;
  const rowsIn = prune
    ? MODEL.steps.map((_, s) => (s === 0 ? rows : rows * MODEL.selectivity))
    : rowsInOrder(rows);
  const work = rowsIn.reduce((sum, n) => sum + (vectorised
    ? n * colsRead * MODEL.vecValueNs + Math.ceil(n / MODEL.batchRows) * MODEL.batchOverheadNs
    : n * (MODEL.rowOverheadNs + colsRead * MODEL.rowValueNs)), 0) * NS;
  const scale = parallel ? speedup(cores) : 1;
  const plan = MODEL.planMs / 1000;
  const exec = work / scale;
  return { colsRead, speedup: scale, plan, exec, total: plan + exec };
}

// Where the row job is at simulated time t: which step, how far through it, overall share done.
export function rowProgress(job, t) {
  let start = 0;
  for (let s = 0; s < job.stepSeconds.length; s++) {
    const len = job.stepSeconds[s];
    if (t < start + len) return { step: s, frac: (t - start) / len, done: false, share: t / job.total };
    start += len;
  }
  return { step: job.stepSeconds.length - 1, frac: 1, done: true, share: 1 };
}

// Share of the columnar job's rows processed at simulated time t (nothing moves while planning).
export function columnarProgress(job, t) {
  return Math.min(1, Math.max(0, (t - job.plan) / job.exec));
}
