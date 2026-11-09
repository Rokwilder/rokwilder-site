// Arizona's published tables do not yield a residency-specific point-level rate
// without mixing 1st and 2nd choice, or without dropping the residency split.
// No hunt history is written. The page says history is not available and why.
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const note = 'History not available. AZGFD\'s bonus-point report counts permits at each point level for the bonus pass and the 1st-2nd choice pass together, so a first-choice rate cannot be separated. The draw-odds sheet is one figure for the whole hunt and is not split by residency. Neither table was used.';
writeFileSync(join(root, 'find/history/arizona.json'), JSON.stringify({
  state: 'arizona',
  words: 'yes',
  years: [],
  note,
  hunts: {}
}));
writeFileSync(join(root, 'find/history/arizona.sources.json'), JSON.stringify({
  state: 'arizona',
  yearsAdded: [],
  unavailable: [
    {year: 2024, why: note},
    {year: 2025, why: note},
    {year: 2026, why: note}
  ],
  examined: [
    {url: 'https://azgfd-live-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/03/20152731/2026-M-Bonus-Point-Report.pdf', finding: 'Permits issued in the bonus pass plus the 1-2 pass exceeded first-choice applicants at 495 point levels, and never exceeded first-plus-second-choice applicants. The column is not a first-choice rate.'},
    {url: 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/22144539/2025-AZ-Elk-Draw-Odds.pdf', finding: 'One first-choice odds figure per hunt. It is not split into resident and nonresident, so it is not the same result the page shows for each residency.'}
  ],
  match: 'No year was matched.',
  band: 'yes',
  page: 'https://www.azgfd.com/hunting/hunt-draw-and-licenses/big-game-draw/bonus-point-process/'
}, null, 2));
console.log('arizona history left empty on purpose');
