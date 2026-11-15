// Montana draw math. Official FWP rules only.
// Bonus points are squared, then one is added for this year's application.
// Preference points are a separate system for nonresident combination licenses.
// A missing point level is not a zero and is not filled from a neighbor.

export function bandOf(success, apps) {
  if (!(apps > 0) || !Number.isInteger(success) || !Number.isInteger(apps) || success < 0 || success > apps) return null;
  if (success === apps) return 1;
  const r = success / apps;
  if (r >= 0.75) return 0.75;
  if (r >= 0.25) return 0.25;
  if (r >= 0.05) return 0.05;
  if (r > 0) return 0.01;
  return 0;
}

export function bandOfRate(rate) {
  if (rate == null || !Number.isFinite(rate) || rate < 0 || rate > 1) return null;
  if (rate >= 1) return 1;
  if (rate >= 0.75) return 0.75;
  if (rate >= 0.25) return 0.25;
  if (rate >= 0.05) return 0.05;
  if (rate > 0) return 0.01;
  return 0;
}

// FWP example: 10 bonus points is (10 x 10) + 1 = 101 chances.
export function bonusChances(points) {
  if (!Number.isInteger(points) || points < 0) return null;
  return points * points + 1;
}

// A printed group is either one total ("2") or a range ("0.2 to 1.8", "2.2 to 3").
export function parsePointGroup(label) {
  const t = String(label).toLowerCase().replace(/preference points?/g, '').replace(/pp/g, '').replace(/[–—]/g, '-').trim();
  const range = t.match(/^(\d*\.?\d+)\s*(?:-|to)\s*(\d*\.?\d+)$/i);
  if (range) return {lo: Number(range[1]), hi: Number(range[2]), exact: false};
  const one = t.match(/^(\d*\.?\d+)$/);
  if (!one) return null;
  const n = Number(one[1]);
  return {lo: n, hi: n, exact: true};
}

// Whole preference points 0, 1, 2, 3. An exact total wins over a range.
export function groupForPoint(groups, point) {
  if (!Number.isInteger(point)) return null;
  let ranged = null;
  for (const g of groups) {
    const span = g.span || parsePointGroup(g.label);
    if (!span) continue;
    if (point + 1e-9 < span.lo || point - 1e-9 > span.hi) continue;
    if (span.exact) return g;
    ranged = ranged || g;
  }
  return ranged;
}
