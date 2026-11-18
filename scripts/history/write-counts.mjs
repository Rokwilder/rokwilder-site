// Shared writer for official tag and applicant counts.
// The private script is gitignored. The public file is a source list only.
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const CODE = /^(ut|wy|id|nv|mt|nm)$/;

export function writeCounts(root, code, pack) {
  if (!CODE.test(code)) throw new Error('bad state code');
  const privateDir = join(root, 'private/fullpass');
  mkdirSync(privateDir, {recursive: true});
  const js = '(function(){\n'
    + 'var add=' + JSON.stringify(pack) + ';\n'
    + 'var root=window.RWQ=window.RWQ||{};\n'
    + 'var pack=root.' + code + '=root.' + code + '||{years:[],hunts:{}};\n'
    + 'var years={};(pack.years||[]).concat(add.years||[]).forEach(function(y){years[y]=1});\n'
    + 'pack.years=Object.keys(years).map(Number).sort(function(a,b){return a-b});\n'
    + 'pack.countsNote=add.note;\n'
    + 'pack.countsSources=add.sources;\n'
    + 'pack.hunts=pack.hunts||{};\n'
    + 'Object.keys(add.hunts||{}).forEach(function(hunt){\n'
    + '  var dest=pack.hunts[hunt]=pack.hunts[hunt]||{};\n'
    + '  var src=add.hunts[hunt];\n'
    + '  Object.keys(src).forEach(function(year){\n'
    + '    var from=src[year]||{};\n'
    + '    var cell=dest[year]=dest[year]||{};\n'
    + '    if(typeof from.quota==="number"&&typeof cell.quota!=="number")cell.quota=from.quota;\n'
    + '    if(typeof from.apps==="number")cell.apps=from.apps;\n'
    + '  });\n'
    + '});\n'
    + '})();\n';
  writeFileSync(join(privateDir, code + '-counts.js'), js);
}

export function writeSourceList(root, stateName, pub) {
  writeFileSync(join(root, 'find/history', stateName + '-counts.sources.json'), JSON.stringify(pub, null, 2) + '\n');
}
