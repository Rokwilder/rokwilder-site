// Build the UnitIQ package unit list from the site's hunt files.
// Colorado, Utah, and Arizona keep the list already in member/units.json.
// Wyoming, Idaho, Nevada, Montana, and New Mexico are read from their public data files.
// Colorado unit 60 and S60 are left out. No odds or tag counts are written here.
// Run: node scripts/app-build-v2.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'member/units.json');

function load(rel, names) {
  const box = {window: {}};
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8') + '\n' + names.map(n => `globalThis.${n}=${n};`).join('\n'), box);
  return box;
}

function sortUnits(list) {
  return [...list].sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
}

function blockedCo(unit) {
  const u = String(unit || '').trim().toUpperCase().replace(/^UNIT\s+/, '').replace(/^0+(\d)/, '$1');
  return u === '60' || u === 'S60';
}

const land = load('find/land-bands.js', []);
const RWLand = land.window.RWLand;

const current = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const units = {
  CO: current.CO,
  UT: current.UT,
  AZ: current.AZ
};

function add(state, species, id) {
  if (!id) return;
  const s = String(id).trim();
  if (!s || s.length > 40) return;
  if (state === 'CO' && blockedCo(s)) return;
  if (!units[state][species]) units[state][species] = [];
  if (!units[state][species].includes(s)) units[state][species].push(s);
}

const wy = load('wyoming/data.js', ['WH']);
units.WY = {elk: [], deer: [], pronghorn: []};
for (const h of Object.values(wy.WH)) {
  if (!units.WY[h.sp]) continue;
  if (!/^\d+$/.test(String(h.area || ''))) continue;
  add('WY', h.sp, String(h.area));
}

const id = load('idaho/data.js', ['IH']);
units.ID = {elk: [], deer: [], pronghorn: []};
for (const h of Object.values(id.IH)) {
  if (!units.ID[h.sp]) continue;
  if (h.draw !== 1) continue;
  if (!RWLand.idKey(h.area)) continue;
  add('ID', h.sp, String(h.area));
}

const nv = load('nevada/data.js', ['NH']);
units.NV = {elk: [], deer: [], pronghorn: []};
for (const h of Object.values(nv.NH)) {
  const sp = h.sp === 'antelope' ? 'pronghorn' : h.sp;
  if (!units.NV[sp]) continue;
  const key = RWLand.nvKey(h.units);
  if (!key) continue;
  for (const part of key.split('+')) add('NV', sp, part);
}

const mt = load('montana/data.js', ['MH']);
units.MT = {elk: [], deer: [], pronghorn: []};
for (const h of Object.values(mt.MH)) {
  const sp = h.sp === 'antelope' ? 'pronghorn' : h.sp;
  if (!units.MT[sp]) continue;
  if (!/^\d+$/.test(String(h.area || ''))) continue;
  add('MT', sp, String(h.area));
}

const nm = load('newmexico/data.js', ['NH']);
units.NM = {elk: [], deer: [], pronghorn: []};
for (const h of Object.values(nm.NH)) {
  if (!units.NM[h.sp]) continue;
  const ids = (h.units && h.units.length) ? h.units : (h.unmapped || []);
  for (const u of ids) {
    if (/^[0-9]+[A-Z]?$/.test(String(u))) add('NM', h.sp, String(u));
  }
}

for (const st of ['WY', 'ID', 'NV', 'MT', 'NM']) {
  for (const sp of ['elk', 'deer', 'pronghorn']) units[st][sp] = sortUnits(units[st][sp]);
}

for (const sp of ['elk', 'deer', 'pronghorn']) {
  if ((units.CO[sp] || []).some(blockedCo)) throw new Error('Colorado ' + sp + ' still lists unit 60 or S60');
}

fs.writeFileSync(outPath, JSON.stringify(units));
const counts = {};
for (const st of Object.keys(units)) {
  counts[st] = {};
  for (const sp of Object.keys(units[st])) counts[st][sp] = units[st][sp].length;
}
console.log(JSON.stringify(counts, null, 2));
