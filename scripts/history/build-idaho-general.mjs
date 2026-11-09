// The nonresident deer and elk draw has a published 2026 result already on the page.
// 2024 and 2025 were not found as the same official report. No average is stored for one year.
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('../..', import.meta.url).pathname;
const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'idaho/general-data.js'), 'utf8') + '\nglobalThis.IG=IG;', sandbox);
const hunts = {};
for (const row of sandbox.IG.draw2026) {
  if (row.band == null) continue;
  hunts[row.k] = {nr:{y:{2026: row.band}}};
}
writeFileSync(join(root, 'find/history/idaho-nr.json'), JSON.stringify({
  state: 'idaho-nr',
  words: 'drew',
  years: [2026],
  note: '2024 and 2025 nonresident draw reports were not on the IDFG page or in the public archive of that PDF, so they are not shown. One year is not averaged. The 2026 band is the same result already on this card.',
  hunts
}));
writeFileSync(join(root, 'find/history/idaho-nr.sources.json'), JSON.stringify({
  state: 'idaho-nr',
  yearsAdded: [2026],
  unavailable: [
    {year: 2024, why: 'No 2024 nonresident draw-data PDF was posted on the IDFG nonresident page, and the Internet Archive only has the 2026 file of that report.'},
    {year: 2025, why: 'No 2025 nonresident draw-data PDF was posted on the IDFG nonresident page, and the Internet Archive only has the 2026 file of that report.'},
    {scope: 'general-season windows', why: 'Those rows are season dates for an over-the-counter tag. They are not draw results.'}
  ],
  match: '2026 zone or unit and tag letter, the same key already on the page. No earlier year is attached.',
  band: 'drew',
  sources: [{
    year: 2026,
    url: sandbox.IG.meta.oddsUrl,
    archive: sandbox.IG.meta.oddsArchive,
    note: 'The band is copied from the public file already built from that PDF. It is not recomputed and the PDF is not re-banded here.'
  }]
}, null, 2));
console.log('nr hunts', Object.keys(hunts).length);
