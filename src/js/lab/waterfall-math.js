// Distribution waterfall maths, kept free of any rendering so it can be tested on its own.
//
// Simplifications (stated on the page too): all capital is called at year 0, the preferred
// return compounds annually, the catch-up is 100% to the manager, and there are no fees,
// recycling, escrow or loss carry-forward. Amounts are in $M.
//
// A "terms" object is { deals: [{ invested, multiple, year }], hurdle, carry }.
// Both functions take a time t in years and return the state of the waterfall at that moment.
// A deal's proceeds arrive over `win` years starting at its exit year, so t can be scrubbed.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const grow = (r, years) => (1 + r) ** years - 1;

// Push an amount through the four tiers. `s` carries the running balances.
// Returns the highest tier that received money (for drawing the active stream).
function distribute(amount, s, carry) {
  let x = amount, top = -1;
  const t1 = Math.min(x, s.capitalOut);           // 1. return of capital, 100% to investors
  s.capitalOut -= t1; s.tier[0] += t1; s.lp += t1; x -= t1; if (t1 > 0) top = 0;
  const t2 = Math.min(x, s.prefOwed);             // 2. preferred return, 100% to investors
  s.prefOwed -= t2; s.tier[1] += t2; s.lp += t2; x -= t2; if (t2 > 0) top = 1;
  const target = (carry / (1 - carry)) * s.tier[1]; // 3. catch-up, 100% to the manager
  const t3 = Math.min(x, Math.max(0, target - s.tier[2]));
  s.tier[2] += t3; s.gp += t3; x -= t3; if (t3 > 0) top = 2;
  if (x > 1e-9) {                                  // 4. residual split
    s.tier[3] += x; s.lp += x * (1 - carry); s.gp += x * carry; top = 3;
  }
  return top;
}

const blank = (capital) => ({ capitalOut: capital, prefOwed: 0, tier: [0, 0, 0, 0], lp: 0, gp: 0 });
const caps = (s, capital, carry) => {
  const pref = s.tier[1] + s.prefOwed;
  return [capital, pref, (carry / (1 - carry)) * pref, null];
};

// European: one waterfall for the whole fund. The manager sees no carry until
// investors have all their capital back plus the preferred return on it.
export function european(terms, t, win = 0.9) {
  const { deals, hurdle, carry } = terms;
  const capital = deals.reduce((a, d) => a + d.invested, 0);
  const s = blank(capital);
  const remaining = deals.map((d) => d.invested * d.multiple);
  let last = 0, flowTier = -1, activeDeal = -1;
  const order = deals.map((d, i) => ({ ...d, i })).sort((a, b) => a.year - b.year);
  for (const d of order) {
    if (t < d.year) break;
    s.prefOwed += (s.capitalOut + s.prefOwed) * grow(hurdle, d.year - last);
    last = d.year;
    const f = clamp01((t - d.year) / win);
    const paid = d.invested * d.multiple * f;
    remaining[d.i] -= paid;
    const top = distribute(paid, s, carry);
    if (f < 1) { flowTier = top; activeDeal = d.i; }
  }
  if (activeDeal < 0 && t > last) s.prefOwed += (s.capitalOut + s.prefOwed) * grow(hurdle, t - last);
  return { cascades: [{ tier: s.tier, cap: caps(s, capital, carry), flowTier, activeDeal }], remaining, lp: s.lp, gp: s.gp };
}

// American: each deal runs its own waterfall when it exits. The manager is paid carry
// on every winner as it lands, with no offset for deals that later lose money.
export function american(terms, t, win = 0.9) {
  const { deals, hurdle, carry } = terms;
  let lp = 0, gp = 0;
  const remaining = [];
  const cascades = deals.map((d, i) => {
    const s = blank(d.invested);
    let flowTier = -1, activeDeal = -1, paid = 0;
    s.prefOwed = d.invested * grow(hurdle, Math.min(t, d.year));
    if (t >= d.year) {
      const f = clamp01((t - d.year) / win);
      paid = d.invested * d.multiple * f;
      const top = distribute(paid, s, carry);
      if (f < 1) { flowTier = top; activeDeal = i; }
    }
    remaining.push(d.invested * d.multiple - paid);
    lp += s.lp; gp += s.gp;
    return { tier: s.tier, cap: caps(s, d.invested, carry), flowTier, activeDeal };
  });
  return { cascades, remaining, lp, gp };
}

// What the manager would have to hand back at the end of the fund if carry was paid
// deal by deal: the carry actually received minus the carry earned on the fund as a whole.
export function clawback(terms) {
  const end = Math.max(...terms.deals.map((d) => d.year)) + 10;
  return Math.max(0, american(terms, end).gp - european(terms, end).gp);
}
