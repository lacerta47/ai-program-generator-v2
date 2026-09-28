import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const rows = readdirSync(dir).filter(f => /-(before|after)\.json$/.test(f)).map(f => JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
const observationsPath = resolve(dir, 'observations.json');
const manifestPath = resolve(dir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const observations = existsSync(observationsPath) ? JSON.parse(readFileSync(observationsPath, 'utf8')) : [];
for (const row of rows) {
  const path = resolve(dir, `${row.id}-${row.version}.actions.json`);
  if (existsSync(path)) row.extended = JSON.parse(readFileSync(path, 'utf8'));
  row.observations = observations.filter(o => o.id === `${row.id}-${row.version}`);
}
const summary = { comparison: manifest.comparison ?? 'prompt-before-vs-after', arms: manifest.arms ?? { before: 'before', after: 'after' }, total: rows.length, versions: {}, types: {}, issues: [] };
const cleanRuntime = r => r.runtime && r.extended && !r.runtime.errors.length && !r.runtime.timeout && !r.extended.errors.length && !r.extended.incomplete && !r.observations.length;
function aggregate(items) {
  const generated = items.filter(r => r.code);
  const checked = generated.filter(r => r.runtime);
  const runtimeBad = r => r.runtime?.errors.length > 0 || r.runtime?.timeout;
  const result = {
    attempts: items.length, generated: generated.length, inspected: checked.length,
    generationErrors: items.filter(r => r.generationError).length,
    beforeGateRejected: generated.filter(r => r.gates?.before).length,
    afterGateRejected: generated.filter(r => r.gates?.after).length,
    runtimeError: checked.filter(r => r.runtime.errors.length).length,
    inspectionIncomplete: checked.filter(r => r.runtime.timeout).length,
    extendedInspected: items.filter(r => r.extended).length,
    combinedRuntimeError: items.filter(r => r.runtime?.errors.length || r.extended?.errors.length || r.observations.length).length,
    combinedAcceptedAndPassed: checked.filter(r => r.extended && !r.gates?.[r.version] && !runtimeBad(r) && !r.extended.errors.length && !r.extended.incomplete && !r.observations.length).length,
    combinedRawSmokePassed: items.filter(cleanRuntime).length,
    combinedGateMiss: items.filter(r => r.code && !r.gates?.[r.version] && (r.runtime?.errors.length || r.extended?.errors.length || r.observations.length)).length,
    combinedRejectedSmokePassed: items.filter(r => r.gates?.[r.version] && cleanRuntime(r)).length,
    gateReasons: items.filter(r => r.gates?.[r.version]).reduce((a, r) => { const reason = r.gates[r.version]; a[reason] = (a[reason] || 0) + 1; return a; }, {}),
    generationErrorNames: items.filter(r => r.generationError).reduce((a, r) => { a[r.generationError] = (a[r.generationError] || 0) + 1; return a; }, {}),
    probes: {
      mazeAutoSupported: items.filter(r => r.extended?.mazeAutoPlay?.supported).length,
      mazePathFound: items.filter(r => r.extended?.mazeAutoPlay?.pathFound).length,
      mazeReachedExit: items.filter(r => r.extended?.mazeAutoPlay?.reachedExit).length,
      mazeVictorySignaled: items.filter(r => r.extended?.mazeAutoPlay?.victorySignaled).length,
      audioRepeated: items.filter(r => r.extended?.audioRepeat?.attempted > 0).length,
      audioRepeatAttempts: items.reduce((n, r) => n + (r.extended?.audioRepeat?.attempted || 0), 0),
    },
    ownGateAcceptedAndSmokePassed: checked.filter(r => !r.gates?.[r.version] && !runtimeBad(r)).length,
    ownGateAcceptedButRuntimeBad: checked.filter(r => !r.gates?.[r.version] && runtimeBad(r)).length,
    ownGateRejectedButSmokePassed: checked.filter(r => r.gates?.[r.version] && !runtimeBad(r)).length,
    generationSeconds: Math.round(items.reduce((n, r) => n + r.generationMs, 0) / Math.max(1, items.length) / 1000),
    usage: { input: 0, output: 0, thinking: 0 },
  };
  for (const r of items) for (const k of Object.keys(result.usage)) result.usage[k] += r.usage?.[k] || 0;
  return result;
}
for (const v of ['before', 'after']) summary.versions[v] = aggregate(rows.filter(r => r.version === v));
for (const type of [...new Set(rows.map(r => r.type))]) {
  summary.types[type] = Object.fromEntries(['before', 'after'].map(v => [v, aggregate(rows.filter(r => r.type === type && r.version === v))]));
}
for (const r of rows) if (r.generationError || r.gates?.before || r.gates?.after || r.runtime?.errors.length || r.runtime?.timeout || r.extended?.errors.length || r.extended?.incomplete || r.observations.length) {
  summary.issues.push({ id: `${r.id}-${r.version}`, generationError: r.generationError, gates: r.gates, runtime: r.runtime, extended: r.extended, observations: r.observations });
}
summary.paired = { bothPass: 0, beforeOnly: 0, afterOnly: 0, neitherPass: 0, pairs: 0 };
for (const before of rows.filter(r => r.version === 'before')) {
  const after = rows.find(r => r.version === 'after' && r.id === before.id);
  if (!after) continue;
  const b = !!cleanRuntime(before) && !before.gates?.before;
  const a = !!cleanRuntime(after) && !after.gates?.after;
  summary.paired.pairs++;
  summary.paired[b && a ? 'bothPass' : b ? 'beforeOnly' : a ? 'afterOnly' : 'neitherPass']++;
}
const discordant = summary.paired.beforeOnly + summary.paired.afterOnly;
let probability = 2 ** -discordant, cumulative = probability;
for (let k = 1; k <= Math.min(summary.paired.beforeOnly, summary.paired.afterOnly); k++) { probability *= (discordant - k + 1) / k; cumulative += probability; }
summary.paired.exactTwoSidedP = Math.min(1, 2 * cumulative);
writeFileSync(resolve(dir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
