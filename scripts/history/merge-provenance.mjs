// Combine the per-state source notes into one provenance file.
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const dir = new URL('../../find/history/', import.meta.url).pathname;
const states = {};
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.sources.json')) continue;
  const data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  states[data.state] = data;
}
const provenance = {
  method: {
    bands: 'Each official yearly draw rate is mapped to the same public band the page already uses. Colorado, Utah, Wyoming and Arizona use 1 at 99.5% and up, then 0.75, 0.25, 0.05, 0.01 and 0. Idaho and Nevada use 1 only when every applicant in that cell was drawn, then the same lower floors. A year with no official row is omitted. It is not stored as zero and it is not filled from another point level.',
    average: 'The average is the arithmetic mean of the official yearly draw rates for the years that have a rate for that hunt and, where the draw uses points, for that exact point level. The mean is then mapped with the same band cutoffs. The mean itself is not published. The label is 3-yr average when three rates are averaged and 2-yr average when two are. One rate is not averaged. A missing year is left out of the mean.',
    trend: 'The trend compares those same official rates in year order, after rounding each rate to six decimal places. Holding steady means the rates are equal. Getting harder means each later rate is lower or equal and the last is lower. Getting easier means each later rate is higher or equal and the last is higher. One year stood out means the first and last rates match and a middle rate does not. Anything else is Up and down. Fewer than two rates has no trend word.'
  },
  states
};
writeFileSync(join(dir, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log('states', Object.keys(states).join(', '));
