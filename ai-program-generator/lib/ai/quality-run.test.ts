// Opt-in paid evaluation; never runs during normal unit tests. Does not publish to Firestore.
import { it, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import ts from 'typescript';
import { loadEnvConfig } from '@next/env';
import { randomPlan } from '../examples/randomPlan';
import { PROGRAM_TYPES } from '../survey/programs';
import { buildPreviewDoc } from '../program';
import { QuotaExhaustedError } from './errors';
import { buildExemplarBlock, exemplarCodeReference, type Exemplar } from './exemplars';

vi.mock('./validateCode', () => ({ validateGeneratedCode: () => null, gateReasonKey: () => '' }));
vi.mock('server-only', () => ({}));

it.skipIf(process.env.LUN_QUALITY_RUN !== '1')('paired generation and sandbox evaluation', async () => {
  const out = resolve(process.env.LUN_QUALITY_OUT!);
  mkdirSync(out, { recursive: true });
  const originalNodeEnv = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'development' });
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} }, true);
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  const exemplarComparison = process.env.LUN_QUALITY_COMPARISON === 'exemplar';
  const exemplarPath = resolve(out, 'exemplars.json');
  const exemplars = new Map<string, Exemplar | null>();
  function moduleFrom(source: string) {
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} as any };
    new Function('exports', 'module', output)(mod.exports, mod);
    return mod.exports;
  }
  const baselineDir = process.env.LUN_QUALITY_BASELINE_DIR ? resolve(process.env.LUN_QUALITY_BASELINE_DIR) : null;
  const versions: Record<string, any> = {};
  for (const version of ['before', 'after']) {
    const modules: Record<string, any> = {};
    for (const name of ['prompts', 'typeGuides', 'validateCode']) {
      const path = `lib/ai/${name}.ts`;
      const source = exemplarComparison
        ? readFileSync(path, 'utf8')
        : version === 'before'
        ? baselineDir
          ? readFileSync(resolve(baselineDir, `after-${name}.ts`), 'utf8')
          : execFileSync('git', ['show', `HEAD:ai-program-generator/${path}`], { encoding: 'utf8' })
        : readFileSync(path, 'utf8');
      writeFileSync(resolve(out, `${version}-${name}.ts`), source);
      modules[name] = moduleFrom(source);
    }
    versions[version] = modules;
  }
  if (exemplarComparison) {
    const accepts = (exemplar: Exemplar | null) =>
      !exemplar || exemplar.codeReference === 'plan-only' || !versions.after.validateCode.validateGeneratedCode(exemplar.code);
    if (existsSync(exemplarPath)) {
      for (const [type, value] of Object.entries(JSON.parse(readFileSync(exemplarPath, 'utf8')))) {
        const exemplar = value as Exemplar | null;
        exemplars.set(type, accepts(exemplar) ? exemplar : null);
      }
    } else {
      const { getExemplar } = await import('../admin/exemplars');
      for (const type of PROGRAM_TYPES) {
        const exemplar = await getExemplar('survey', type.id);
        exemplars.set(type.id, accepts(exemplar) ? exemplar : null);
      }
      writeFileSync(exemplarPath, JSON.stringify(Object.fromEntries(exemplars), null, 2));
    }
    const { adminDb } = await import('../firebase/admin');
    const inventory: Record<string, unknown> = {};
    for (const [type, exemplar] of exemplars) {
      if (!exemplar) {
        inventory[type] = null;
        continue;
      }
      const source = (await adminDb.collection('posts').doc(exemplar.sourcePostId).get()).data() as { code?: { html?: string; css?: string; javascript?: string } } | undefined;
      const sourceCode = source?.code;
      const sourceCodeChars = sourceCode ? {
        html: sourceCode.html?.length ?? 0,
        css: sourceCode.css?.length ?? 0,
        javascript: sourceCode.javascript?.length ?? 0,
      } : null;
      const sourceCodeValidationError = sourceCode
        ? versions.after.validateCode.validateGeneratedCode(sourceCode)
        : null;
      inventory[type] = {
        sourcePostId: exemplar.sourcePostId,
        sourceTitle: exemplar.sourceTitle,
        scope: exemplar.programType === type ? 'typed' : 'survey-common',
        codeReference: exemplarCodeReference(exemplar.code),
        sourceCodeChars,
        sourceCodeTotal: sourceCodeChars ? Object.values(sourceCodeChars).reduce((sum, n) => sum + n, 0) : null,
        sourceCodeValid: sourceCode ? !sourceCodeValidationError : null,
        sourceCodeValidationError,
      };
    }
    writeFileSync(resolve(out, 'exemplar-inventory.json'), JSON.stringify(inventory, null, 2));
  }
  if (process.env.LUN_QUALITY_PREFLIGHT_ONLY === '1') {
    console.log(JSON.stringify({ preflight: true, exemplarInventory: resolve(out, 'exemplar-inventory.json') }));
    return;
  }
  if (!process.env.GEMINI_API_KEY_PAID && !process.env.GEMINI_API_KEY) throw new Error('Application key unavailable; no API requests sent');
  const req = createRequire(import.meta.url);
  const { chromium } = req('C:/Users/amh47/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const manifestPath = resolve(out, 'manifest.json');
  let plans: any[];
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (exemplarComparison && manifest.comparison !== 'exemplar-off-vs-on') {
      throw new Error('Quality output comparison mismatch: expected exemplar-off-vs-on');
    }
    plans = manifest.plans;
  }
  else {
    plans = [];
    let seed = 9092026;
    const original = Math.random;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    try {
      for (const type of PROGRAM_TYPES) {
        const n = ['paint', 'maze', 'sound', 'aquarium'].includes(type.id) ? 15 : 5;
        for (let i = 0; i < n; i++) {
          const p = randomPlan(PROGRAM_TYPES.filter(t => t.id !== type.id).map(t => t.id));
          const requirements = type.steps.flatMap((step) => {
            const answer = p.answers[step.id];
            const ids = Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : [];
            return ids.flatMap((optionId) => {
              const option = step.options.find((candidate) => candidate.id === optionId);
              return option ? [{
                stepId: step.id,
                optionId,
                label: option.label,
                promptFragment: option.promptFragment,
                negative: /(?:넣지 마|없이|제외|없어도|아니[,.]? 괜찮)/.test(option.promptFragment + option.label),
              }] : [];
            });
          });
          plans.push({ id: `${type.id}-${i}`, type: type.id, prompt: p.prompt, answers: p.answers, title: p.plan.name, plan: p.plan, requirements });
        }
      }
    } finally { Math.random = original; }
    const planLimit = Number(process.env.LUN_QUALITY_PLAN_LIMIT || 0);
    if (planLimit > 0 && planLimit < plans.length) {
      const buckets = PROGRAM_TYPES.map((type) => plans.filter((plan) => plan.type === type.id));
      const selected = [];
      while (selected.length < planLimit && buckets.some((bucket) => bucket.length)) {
        for (const bucket of buckets) {
          if (selected.length >= planLimit) break;
          const plan = bucket.shift();
          if (plan) selected.push(plan);
        }
      }
      plans = selected;
    }
    writeFileSync(manifestPath, JSON.stringify({
      seed: 9092026,
      mode: 'paid-normal',
      comparison: exemplarComparison ? 'exemplar-off-vs-on' : 'prompt-before-vs-after',
      arms: exemplarComparison ? { before: 'exemplar-off', after: 'exemplar-on' } : { before: 'previous', after: 'candidate' },
      exemplars: exemplarComparison ? 'paired' : false,
      photo: false,
      plans,
    }, null, 2));
  }
  const typeFilter = process.env.LUN_QUALITY_TYPES
    ? new Set(process.env.LUN_QUALITY_TYPES.split(',').filter(Boolean))
    : null;
  if (typeFilter) plans = plans.filter((plan) => typeFilter.has(plan.type));
  const docs = new Map<string, string>();
  const server = createServer((request, response) => {
    const id = (request.url || '').slice(1);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (id.startsWith('frame/')) {
      response.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
      response.end(docs.get(id.slice(6)) || 'missing');
    } else {
      const port = (server.address() as any).port;
      response.end(`<iframe style="width:1100px;height:780px" sandbox="allow-scripts" src="http://127.0.0.1:${port}/frame/${id}"></iframe>`);
    }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as any).port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  async function inspect(id: string, code: any) {
    docs.set(id, buildPreviewDoc(code));
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: false });
    await context.route('**/*', (route: any) => {
      const u = new URL(route.request().url());
      return u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname) && u.port === String(port) && route.request().method() === 'GET' ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const result: any = { errors: [], actions: [], externalNetworkBlocked: true, timeout: false };
    let stage = 'load';
    page.on('pageerror', (error: Error) => result.errors.push({ stage, message: error.message }));
    const work = async () => {
      await page.goto(`http://localhost:${port}/${id}`, { timeout: 8000 });
      await page.waitForTimeout(1000);
      const frame = page.frames().find((f: any) => f.url().includes('/frame/'));
      if (!frame) throw new Error('iframe not found');
      stage = 'interaction';
      const buttons = frame.locator('button, input[type=button], input[type=submit], [role=button]');
      const count = Math.min(await buttons.count(), 8);
      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        try {
          const label = (await button.textContent({ timeout: 500 }))?.slice(0, 60);
          await button.click({ timeout: 700 });
          result.actions.push({ label, ok: true });
        } catch { result.actions.push({ index: i, ok: false }); }
      }
      for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Space']) await page.keyboard.press(key);
      const canvas = frame.locator('canvas').first();
      if (await canvas.count()) {
        const box = await canvas.boundingBox({ timeout: 700 });
        if (box) { await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 100, { steps: 8 }); await page.mouse.up(); result.actions.push({ canvasDrag: true }); }
      }
      await page.waitForTimeout(1500);
      result.text = (await frame.locator('body').innerText({ timeout: 1000 })).slice(0, 1200);
      await page.screenshot({ path: resolve(out, `${id}.png`), timeout: 2000 });
    };
    let timer: ReturnType<typeof setTimeout>;
    try { await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('inspection deadline')), 18000); })]); }
    catch (e) { result.timeout = true; result.harnessError = (e as Error).message; }
    finally { clearTimeout(timer!); await context.close(); docs.delete(id); }
    return result;
  }
  const { GeminiProvider } = await import('./gemini');
  const jobs = plans.flatMap((p, i) => (i % 2 ? ['after', 'before'] : ['before', 'after']).map(version => ({ ...p, version })));
  let next = 0, completed = 0, quotaFailures = 0;
  try {
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < jobs.length && quotaFailures < 2) {
        const job = jobs[next++];
        const id = `${job.id}-${job.version}`;
        const file = resolve(out, `${id}.json`);
        if (existsSync(file)) {
          const saved = JSON.parse(readFileSync(file, 'utf8'));
          saved.version = job.version;
          if (saved.code) saved.gates = Object.fromEntries(Object.entries(versions).map(([v, c]) => [v, c.validateCode.validateGeneratedCode(saved.code)]));
          if (saved.code && !saved.runtime) { saved.runtime = await inspect(id, saved.code); writeFileSync(file, JSON.stringify(saved, null, 2)); }
          else writeFileSync(file, JSON.stringify(saved, null, 2));
          completed++; continue;
        }
        const config = versions[job.version];
        const exemplar = exemplarComparison && job.version === 'after' ? exemplars.get(job.type) : null;
        const generationPrompt = exemplar ? buildExemplarBlock(exemplar) + job.prompt : job.prompt;
        const row: any = {
          ...job,
          comparisonArm: exemplarComparison ? (job.version === 'after' ? 'exemplar-on' : 'exemplar-off') : job.version,
          exemplarApplied: Boolean(exemplar),
          exemplarSourcePostId: exemplar?.sourcePostId ?? null,
          code: null,
          usage: null,
          generationError: null,
          startedAt: new Date().toISOString(),
        };
        const start = Date.now();
        try {
          for await (const chunk of new GeminiProvider().generateStream({ prompt: generationPrompt, system: config.prompts.SYSTEM_PROMPTS.survey + config.typeGuides.getTypeGuide(job.type, job.prompt) + config.prompts.LOGIC_META_INSTRUCTION, mode: 'generate', tier: 'paid' }, AbortSignal.timeout(180000))) {
            if (chunk.type === 'done') { row.code = chunk.code; row.usage = chunk.usage; row.meta = chunk.meta; }
          }
          if (!row.code) row.generationError = 'no-done';
        } catch (e) { row.generationError = e instanceof QuotaExhaustedError ? 'QuotaExhaustedError' : (e as Error).name; if (row.generationError === 'QuotaExhaustedError') quotaFailures++; }
        row.generationMs = Date.now() - start;
        if (row.code) {
          row.gates = Object.fromEntries(Object.entries(versions).map(([v, c]) => [v, c.validateCode.validateGeneratedCode(row.code)]));
          writeFileSync(file, JSON.stringify(row, null, 2));
          row.runtime = await inspect(id, row.code);
        }
        writeFileSync(file, JSON.stringify(row, null, 2));
        console.log(JSON.stringify({ completed: ++completed, total: jobs.length, id, error: row.generationError, gates: row.gates, runtimeErrors: row.runtime?.errors.length, timeout: row.runtime?.timeout, seconds: Math.round(row.generationMs / 1000) }));
      }
    }));
  } finally { await browser.close(); server.close(); }
}, 14400000);
