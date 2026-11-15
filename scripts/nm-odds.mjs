// New Mexico draw math. Official NMDGF rules only.
// First-choice rate = first-choice drawn / first-choice applicants in the same pool.
// Zero applicants is a missing rate, not a zero. A missing drawn count is not filled in.
import {bandDrew} from './history/bands.mjs';

export const GMUS = [
  '1','2A','2B','2C','3','4','5A','5B','6A','6B','6C','7','8','9','10','11','12','13','14','15','16A','16B','16C','16D','16E',
  '17','18','19','20','21A','21B','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40',
  '41','42','43','45','46','47','48','49','50','51A','51B','52','53','54','55A','55B','56','57','58','59'
];
const GMU_SET = new Set(GMUS);

export function bandOf(rate) {
  return bandDrew(rate);
}

// drawn and apps are official counts for one pool and one choice.
// Returns null when applicants are zero or the drawn count was not published.
export function firstChoiceRate(drawn, apps) {
  if (apps == null || !Number.isFinite(apps) || apps <= 0) return null;
  if (drawn == null || !Number.isFinite(drawn) || drawn < 0) return null;
  return drawn / apps;
}

export function gmuSort(a, b) {
  const pa = String(a).toUpperCase().match(/^(\d+)([A-Z]?)$/);
  const pb = String(b).toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!pa || !pb) return String(a).localeCompare(String(b), undefined, {numeric: true});
  if (+pa[1] !== +pb[1]) return +pa[1] - +pb[1];
  return (pa[2] || '').localeCompare(pb[2] || '');
}

// Pull official GMU codes out of a hunt description. Road numbers and years are ignored
// because they are not in the 2026 GMU list. "54/55" is two units.
// The 2026 map has 2A, 2B, and 2C, not a polygon named 2. The same is true for 5, 6, 16, 21, 51, and 55.
// A hunt that says "Unit 2" names that parent. It is not expanded into the lettered units.
const PARENTS = new Set(['2', '5', '6', '16', '21', '51', '55']);

export function parentTokens(text) {
  const src = String(text || '').replace(/(\d{1,2}[A-E]?)\s*\/\s*(\d{1,2}[A-E]?)/gi, '$1, $2');
  const found = [];
  const re = /\b(2|5|6|16|21|51|55)(?![A-E0-9])/g;
  let m;
  while ((m = re.exec(src))) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

export function parseUnits(text) {
  if (text == null) return [];
  const src = String(text).replace(/(\d{1,2}[A-E]?)\s*\/\s*(\d{1,2}[A-E]?)/gi, '$1, $2');
  const found = [];
  const re = /\b(\d{1,2})([A-E])?\b/g;
  let m;
  while ((m = re.exec(src))) {
    const code = m[1] + (m[2] || '');
    if (!GMU_SET.has(code) || found.includes(code)) continue;
    found.push(code);
  }
  return found.sort(gmuSort);
}

export function nmKey(units) {
  const ids = parseUnits(Array.isArray(units) ? units.join(' ') : units);
  // parseUnits on an already-split list joined by spaces is safe: each token is a GMU.
  if (Array.isArray(units) && units.length && units.every(u => GMU_SET.has(String(u).toUpperCase()))) {
    return [...new Set(units.map(u => String(u).toUpperCase()))].sort(gmuSort).join('+');
  }
  return ids.length ? ids.join('+') : null;
}

export function weaponFromCode(code) {
  const m = String(code || '').match(/^[A-Z]{3}-(\d)-/);
  if (!m) return {wpn: '', wlab: ''};
  if (m[1] === '1') return {wpn: 'any', wlab: 'Any legal sporting arm'};
  if (m[1] === '2') return {wpn: 'bow', wlab: 'Bow'};
  if (m[1] === '3') return {wpn: 'muzzle', wlab: 'Muzzleloader or bow'};
  return {wpn: '', wlab: ''};
}

// Antlerless elk, and a hunt the report limits to a wildlife management area, are resident only.
// "Including" a WMA is not the same as "WMA only".
export function residentOnly(rec) {
  const unit = String(rec.unit || '');
  const bag = String(rec.bag || '').toUpperCase();
  const elkAntlerless = rec.sp === 'elk' && bag === 'A';
  const wmaOnly = /\bWMAs?\s+only\b/i.test(unit);
  const noted = rec.bookResOnly === true;
  let why = '';
  if (elkAntlerless) why = 'Antlerless elk licenses go to New Mexico residents.';
  else if (wmaOnly) why = 'This hunt is held only on a wildlife management area. Those hunts go to New Mexico residents.';
  else if (noted) why = 'The 2026-27 booklet says this hunt is for New Mexico residents.';
  return {resOnly: elkAntlerless || wmaOnly || noted, why};
}

export function normDesc(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export const SPECIES = {
  ELK: 'elk',
  DEER: 'deer',
  PRONGHORN: 'pronghorn',
  'BARBARY SHEEP': 'barbary',
  'BIGHORN SHEEP': 'bighorn',
  IBEX: 'ibex',
  JAVELINA: 'javelina',
  ORYX: 'oryx',
  BEAR: 'bear',
  TURKEY: 'turkey'
};

export const PREFIX = {
  ELK: 'elk', DER: 'deer', ANT: 'pronghorn', BBY: 'barbary', BHS: 'bighorn',
  IBX: 'ibex', JAV: 'javelina', ORX: 'oryx', BER: 'bear', TUR: 'turkey'
};

export function speciesOf(name, code) {
  const key = String(name || '').trim().toUpperCase();
  if (SPECIES[key]) return SPECIES[key];
  const pref = String(code || '').slice(0, 3).toUpperCase();
  return PREFIX[pref] || '';
}
