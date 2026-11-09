// Public history: bands only, averages only from 2 or 3 official years, no percentages.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {averageOf, bandDrew, bandYes, trendOf} from './history/bands.mjs';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

ok(bandYes(1) === 1 && bandYes(0.995) === 1 && bandYes(0.994) === 0.75, 'yes band treats 99.5% as the top band');
ok(bandYes(0.75) === 0.75 && bandYes(0.25) === 0.25 && bandYes(0.05) === 0.05 && bandYes(0.01) === 0.01 && bandYes(0) === 0, 'yes band floors');
ok(bandDrew(1) === 1 && bandDrew(0.999) === 0.75 && bandDrew(0) === 0, 'drew band is all-drew only at a complete draw');
const three = averageOf([1, 0.5, 0], 'yes');
ok(three && three.n === 3 && three.label === '3-yr average' && three.band === bandYes(0.5), 'three rates average to the band of their mean');
const two = averageOf([0.8, 0.2], 'yes');
ok(two && two.n === 2 && two.label === '2-yr average' && two.band === 0.25, 'two rates are a 2-yr average');
ok(averageOf([0.4], 'yes') === null && averageOf([0.2, 0.2, 0.2, 0.2], 'yes') === null, 'one rate and four rates are not averaged');
ok(trendOf([0.8, 0.76, 0.74]) === 'Getting harder', 'a falling rate is getting harder even inside one band');
ok(trendOf([0.2, 0.2, 0.2]) === 'Holding steady', 'equal rates hold steady');
ok(trendOf([0.1, 0.9, 0.1]) === 'One year stood out', 'a middle spike is one year that stood out');
ok(trendOf([0.2, 0.8]) === 'Getting easier', 'a rising pair is getting easier');
ok(trendOf([0.9, 0.1, 0.4]) === 'Up and down', 'a reversal that does not return is up and down');
ok(trendOf([0.4]) === null, 'one rate has no trend');
ok(averageOf([0.8, 0.76, 0.74], 'yes').band === 0.75, 'the published average is the band, not the mean');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
const trends = new Set(['Getting harder', 'Getting easier', 'Holding steady', 'One year stood out', 'Up and down']);
const dir = join(root, 'find/history');
const files = readdirSync(dir).filter(name => name.endsWith('.json') && !name.endsWith('.sources.json') && name !== 'provenance.json');
ok(files.length >= 6, 'history files exist for the states');
const prov = JSON.parse(readFileSync(join(dir, 'provenance.json'), 'utf8'));
ok(/arithmetic mean/.test(prov.method.average) && /3-yr average/.test(prov.method.average) && /not published/.test(prov.method.average), 'provenance documents the average');
ok(/not stored as zero/.test(prov.method.bands), 'provenance says a missing year is not zero');

function walk(node, path, bad) {
  if (node == null) return;
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, path + '[' + i + ']', bad)); return; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (/rate|odds|pct|quota|applicant|permit|raw|percent/i.test(k)) bad.push(path + '.' + k);
      walk(v, path + '.' + k, bad);
    }
    return;
  }
  if (typeof node === 'string' && (/%/.test(node) || /\d+\.\d{2,}/.test(node))) bad.push(path + '=' + node);
}

for (const name of files) {
  const text = readFileSync(join(dir, name), 'utf8');
  const data = JSON.parse(text);
  ok(!/%/.test(text), name + ' has no percent sign');
  const bad = [];
  walk(data, name, bad);
  ok(bad.length === 0, name + ' has no raw fields or loose decimals' + (bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''));
  const state = prov.states[data.state];
  ok(state && JSON.stringify(state.yearsAdded) === JSON.stringify(data.years), name + ' years match the provenance record');
  if (data.years.length) {
    const rows = state.sources || [];
    ok(rows.length > 0 && rows.every(s => [s.url, s.page, s.pdf, s.viewer].some(v => typeof v === 'string' && /^https:\/\//.test(v))), name + ' provenance sources are https urls');
  }
  let avgOk = 0, avgBad = 0, trendBad = 0, yearBad = 0;
  const checkRec = rec => {
    if (!rec || !rec.y) return;
    for (const [year, value] of Object.entries(rec.y)) {
      if (!data.years.map(String).includes(String(year))) yearBad++;
      const cells = value && typeof value === 'object' ? Object.values(value) : [value];
      for (const cell of cells) if (!bands.has(cell)) avgBad++;
    }
    const pointed = Object.values(rec.y).some(v => v && typeof v === 'object');
    if (!pointed) {
      if (rec.n != null) {
        if ((rec.n !== 2 && rec.n !== 3) || !bands.has(rec.a)) avgBad++;
        else avgOk++;
        const count = Object.keys(rec.y).length;
        if (rec.n !== count) avgBad++;
      } else if (Object.keys(rec.y).length >= 2) avgBad++;
      if (rec.t && !trends.has(rec.t)) trendBad++;
      if (Object.keys(rec.y).length < 2 && rec.t) trendBad++;
    } else {
      const ns = rec.n || {};
      for (const [point, n] of Object.entries(ns)) {
        if ((n !== 2 && n !== 3) || !bands.has(rec.a[point])) avgBad++;
        else avgOk++;
        const count = data.years.filter(year => rec.y[year] && rec.y[year][point] != null).length;
        if (n !== count) avgBad++;
      }
      for (const [point, word] of Object.entries(rec.t || {})) {
        if (!trends.has(word)) trendBad++;
        const count = data.years.filter(year => rec.y[year] && rec.y[year][point] != null).length;
        if (count < 2) trendBad++;
      }
    }
  };
  for (const hunt of Object.values(data.hunts)) {
    if (hunt.y) checkRec(hunt);
    else for (const side of Object.values(hunt)) checkRec(side);
  }
  ok(avgBad === 0 && yearBad === 0, name + ' averages are 2-yr or 3-yr bands and years are listed');
  ok(trendBad === 0, name + ' trend words are the published set and need two years');
  if (data.state === 'arizona') ok(Object.keys(data.hunts).length === 0 && /History not available/.test(data.note), 'Arizona states why history is not shown');
  if (data.state === 'idaho-nr') ok(data.years.length === 1 && avgOk === 0, 'Idaho nonresident history is one year and has no average');
}
ok(prov.states.colorado && prov.states.nevada && prov.states.utah && prov.states.wyoming && prov.states.idaho, 'provenance covers the parsed states');
ok((prov.states.nevada.unavailable || []).some(row => row.year === 2026), 'Nevada records that 2026 was not published');
ok((prov.states.utah.unavailable || []).some(row => row.year === 2026), 'Utah records that 2026 was not a full table');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
