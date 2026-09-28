import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve(process.argv[2] || '');
const output = resolve(process.argv[3] || '');
const typeFilter = process.argv[4] ? new Set(process.argv[4].split(',').filter(Boolean)) : null;
for (const required of ['manifest.json', 'after-prompts.ts', 'after-typeGuides.ts', 'after-validateCode.ts']) {
  if (!existsSync(resolve(source, required))) throw new Error(`baseline file missing: ${required}`);
}
mkdirSync(output, { recursive: true });
const sourceManifest = JSON.parse(readFileSync(resolve(source, 'manifest.json'), 'utf8'));
const plans = sourceManifest.plans.filter(plan => !typeFilter || typeFilter.has(plan.type));
const manifestPath = resolve(output, 'manifest.json');
if (!existsSync(manifestPath)) {
  writeFileSync(manifestPath, JSON.stringify({ ...sourceManifest, plans, comparison: 'previous-after vs current-candidate', reusedFrom: source }, null, 2));
}
const observationsPath = resolve(source, 'observations.json');
if (existsSync(observationsPath)) {
  const observations = JSON.parse(readFileSync(observationsPath, 'utf8'))
    .filter(item => /-after$/.test(item.id))
    .filter(item => !typeFilter || typeFilter.has(String(item.id).split('-')[0]))
    .map(item => ({ ...item, id: item.id.replace(/-after$/, '-before'), reusedFrom: observationsPath }));
  writeFileSync(resolve(output, 'observations.json'), JSON.stringify(observations, null, 2));
}
let rows = 0, actions = 0, screenshots = 0;
for (const name of readdirSync(source)) {
  if (/-after\.json$/.test(name)) {
    const row = JSON.parse(readFileSync(resolve(source, name), 'utf8'));
    if (typeFilter && !typeFilter.has(row.type)) continue;
    const target = resolve(output, name.replace(/-after\.json$/, '-before.json'));
    const { gates: _oldGates, ...baseline } = row;
    writeFileSync(target, JSON.stringify({ ...baseline, version: 'before', reusedFrom: resolve(source, name) }, null, 2));
    rows++;
  } else if (/-after\.actions\.json$/.test(name)) {
    if (typeFilter && !typeFilter.has(name.split('-')[0])) continue;
    const target = resolve(output, name.replace(/-after\.actions\.json$/, '-before.actions.json'));
    const action = JSON.parse(readFileSync(resolve(source, name), 'utf8'));
    writeFileSync(target, JSON.stringify({ ...action, id: String(action.id).replace(/-after$/, '-before'), reusedFrom: resolve(source, name) }, null, 2));
    actions++;
  } else if (/-after\.png$/.test(name)) {
    if (typeFilter && !typeFilter.has(name.split('-')[0])) continue;
    const target = resolve(output, name.replace(/-after\.png$/, '-before.png'));
    copyFileSync(resolve(source, name), target);
    screenshots++;
  }
}
if (rows !== plans.length) throw new Error(`expected ${plans.length} previous candidate rows, found ${rows}`);
console.log(JSON.stringify({ prepared: output, baselineRows: rows, actionRecords: actions, screenshots }));
