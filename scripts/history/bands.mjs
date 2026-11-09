// Public draw-history bands. Rates stay in the build step. The site receives bands only.
// "yes" cutoffs match Colorado, Utah, Arizona and Wyoming (YES at 99.5% and up).
// "drew" cutoffs match Idaho and Nevada (ALL DREW only when every applicant was drawn).

export function bandYes(rate) {
  if (rate == null || !Number.isFinite(rate) || rate < 0) return null;
  if (rate >= 0.995) return 1;
  if (rate >= 0.75) return 0.75;
  if (rate >= 0.25) return 0.25;
  if (rate >= 0.05) return 0.05;
  if (rate > 0) return 0.01;
  return 0;
}

export function bandDrew(rate) {
  if (rate == null || !Number.isFinite(rate) || rate < 0) return null;
  if (rate >= 1) return 1;
  if (rate >= 0.75) return 0.75;
  if (rate >= 0.25) return 0.25;
  if (rate >= 0.05) return 0.05;
  if (rate > 0) return 0.01;
  return 0;
}

export function bandOf(rate, style) {
  return style === 'drew' ? bandDrew(rate) : bandYes(rate);
}

function round6(rate) {
  return Math.round(rate * 1e6) / 1e6;
}

// rates are official yearly draw rates in chronological order. Nulls are years with no row.
export function trendOf(rates) {
  const vals = rates.filter(v => v != null && Number.isFinite(v)).map(round6);
  if (vals.length < 2) return null;
  if (vals.every(v => v === vals[0])) return 'Holding steady';
  let nonInc = true;
  let nonDec = true;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] > vals[i - 1]) nonInc = false;
    if (vals[i] < vals[i - 1]) nonDec = false;
  }
  if (nonInc && vals.at(-1) < vals[0]) return 'Getting harder';
  if (nonDec && vals.at(-1) > vals[0]) return 'Getting easier';
  if (vals[0] === vals.at(-1)) return 'One year stood out';
  return 'Up and down';
}

// Simple mean of the official rates, then the same public band. No average for 1 rate.
// A 4th rate is refused rather than labeled as a 3-year average.
export function averageOf(rates, style) {
  const vals = rates.filter(v => v != null && Number.isFinite(v));
  if (vals.length < 2 || vals.length > 3) return null;
  const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
  const band = bandOf(Math.min(1, mean), style);
  if (band == null) return null;
  return {band, n: vals.length, label: vals.length === 3 ? '3-yr average' : '2-yr average'};
}

export function packScalar(yearRates, years, style) {
  const ordered = years.map(y => yearRates[y] ?? null);
  const present = ordered.filter(v => v != null);
  if (!present.length) return null;
  const avg = averageOf(present, style);
  const y = {};
  years.forEach((year, i) => {
    if (ordered[i] == null) return;
    y[year] = bandOf(ordered[i], style);
  });
  const out = {y};
  if (avg) {
    out.a = avg.band;
    out.n = avg.n;
  }
  const trend = trendOf(present);
  if (trend) out.t = trend;
  return out;
}

// yearPoints: {2024: { "0": rate, "5": rate }, ...}
export function packPoints(yearPoints, years, style) {
  const points = new Set();
  for (const year of years) {
    const row = yearPoints[year];
    if (!row) continue;
    for (const point of Object.keys(row)) points.add(point);
  }
  if (!points.size) return null;
  const y = {};
  const a = {};
  const n = {};
  const t = {};
  let any = false;
  for (const year of years) {
    const row = yearPoints[year];
    if (!row) continue;
    const bands = {};
    for (const point of points) {
      if (row[point] == null) continue;
      bands[point] = bandOf(row[point], style);
      any = true;
    }
    if (Object.keys(bands).length) y[year] = bands;
  }
  if (!any) return null;
  for (const point of points) {
    const rates = years.map(year => yearPoints[year]?.[point] ?? null);
    const avg = averageOf(rates, style);
    const trend = trendOf(rates);
    if (avg) {
      a[point] = avg.band;
      n[point] = avg.n;
    }
    if (trend) t[point] = trend;
  }
  const out = {y};
  if (Object.keys(a).length) {
    out.a = a;
    out.n = n;
  }
  if (Object.keys(t).length) out.t = t;
  return out;
}
