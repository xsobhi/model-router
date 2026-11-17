#!/usr/bin/env node
// Benchmark: the same task with and without the model-router plugin, on Claude Code.
// Usage: node bench/run.mjs [--scenario natural|delegate] [--arms A,B] [--tag LABEL] [--runs 3] [--model opus] [--budget 5] [--cap 25] [--out DIR]
//        node bench/run.mjs --summarize bench/results/claude.json
// Runs are interleaved (A1 B1 A2 B2 ...). --budget is passed to claude as --max-budget-usd for each run; the script
// stops before a run if total spend so far (results.json in --out, so repeated invocations add up) plus --budget
// would pass --cap. Raw stream-json transcripts and results.json go to --out (default: a temp dir, not the repo).
// Every run gets its own throwaway CLAUDE_CONFIG_DIR and HOME. Only the OAuth credentials file is copied
// into it (chmod 600) and the whole directory is deleted afterwards. Nothing from your real ~/.claude is read.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = path.join(REPO, 'bench', 'fixture');

const TAIL = `3. Implement the feature described in docs/FEATURE.md (its tests are already in test/report.test.js).`;
export const PROMPTS = {
  // The prompt only allows delegation; the main agent decides.
  natural: `The test suite of this project (npm test) has several failing tests spread over different modules: cart, tax, orders, inventory and report. Please do three things.

1. Investigate why the tests fail. There is a fair amount to look through, so use sub-agents for the investigation as you see fit (for example one per failing module, in parallel) and have them report back.
2. Fix the underlying bugs in src/. Do not edit the tests.
${TAIL}

Finish with npm test passing and a three-line summary of what was wrong and what you changed.`,
  // The prompt asks for the delegation-heavy workflow, so there is something for the plugin to route.
  delegate: `The test suite of this project (npm test) has several failing tests spread over different modules: cart, tax, orders, inventory and report. Please work like this.

1. Start one sub-agent per failing module, in parallel, to find the root cause and report back. They investigate only; they do not edit files.
2. Then have sub-agents make the fixes in src/ (do not edit the tests) and implement the feature described in docs/FEATURE.md (its tests are already in test/report.test.js).
3. You review their work and run npm test until it passes.

Finish with a three-line summary of what was wrong and what changed.`,
};

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : 'n/a');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
}

function cleanEnv(cfg, home) {
  // Nothing inherited from the calling session (CLAUDE_*, CLAUDE_CODE_SUBAGENT_MODEL, API keys, ...).
  return { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8', CLAUDE_CONFIG_DIR: cfg };
}

function freshHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-home-'));
  const cfg = path.join(home, 'claude');
  fs.mkdirSync(cfg, { mode: 0o700 });
  const creds = process.env.CLAUDE_CREDENTIALS ?? path.join(os.homedir(), '.claude', '.credentials.json');
  fs.copyFileSync(creds, path.join(cfg, '.credentials.json'));
  fs.chmodSync(path.join(cfg, '.credentials.json'), 0o600);
  return { home, cfg };
}

// Plan usage. `claude -p /usage` is a local command: no model call, no tokens, no cost. In a brand-new config dir
// Claude Code has no cached snapshot, so it asks the usage endpoint (in an old dir it can answer from a snapshot
// that is minutes old). This account only reports a weekly window; there is no five-hour one.
export function readUsage() {
  const { home, cfg } = freshHome();
  try {
    const out = execFileSync('claude', ['-p', '/usage', '--output-format', 'json'], { env: cleanEnv(cfg, home), cwd: home, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
    const text = JSON.parse(out).result ?? '';
    const pct = (re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
    return { at: new Date().toISOString(), weekly: pct(/Current week \(all models\): (\d+)% used/), session5h: pct(/Current session[^:]*: (\d+)% used/), text };
  } catch (e) { return { at: new Date().toISOString(), weekly: null, session5h: null, text: String(e.message).slice(0, 200) }; }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}

function makeConfig(arm) {
  const { home, cfg } = freshHome();
  if (arm === 'B') {
    const env = cleanEnv(cfg, home);
    const opts = { env, cwd: home, stdio: 'pipe' };
    execFileSync('claude', ['plugin', 'marketplace', 'add', REPO], opts);
    execFileSync('claude', ['plugin', 'install', 'model-router@model-router'], opts);
  }
  return { home, cfg };
}

function runClaude({ cfg, home }, cwd, { model, budget, maxTurns, outFile, prompt }) {
  const args = ['-p', prompt, '--model', model, '--max-turns', String(maxTurns), '--max-budget-usd', String(budget),
    '--permission-mode', 'bypassPermissions', '--output-format', 'stream-json', '--verbose'];
  return new Promise((resolve) => {
    const out = fs.createWriteStream(outFile);
    const p = spawn('claude', args, { cwd, env: cleanEnv(cfg, home), stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.pipe(out);
    let err = ''; let lastOutAt = Date.now(); let sawResult = false; let idleKilled = false;
    p.stdout.on('data', (d) => { lastOutAt = Date.now(); if (d.includes('"type":"result"')) sawResult = true; });
    p.stderr.on('data', (d) => (err += d));
    // Once in a while claude -p finishes its work but never exits (one of 12 runs hung 14 minutes). Stop it after
    // 2 minutes of silence that follow a result, and count the run's time up to its last output.
    const idle = setInterval(() => { if (sawResult && Date.now() - lastOutAt > 120000) { idleKilled = true; p.kill('SIGTERM'); } }, 5000);
    const timer = setTimeout(() => p.kill('SIGKILL'), 30 * 60 * 1000);
    p.on('close', (code, signal) => { clearTimeout(timer); clearInterval(idle); resolve({ code, signal, err: err.slice(0, 500), idleKilled, lastOutAt }); });
  });
}

function parseStream(file) {
  const msgs = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const results = msgs.filter((m) => m.type === 'result');
  // The stream's own rate_limit_event comes from the API response headers of that run (utilization 0 to 1).
  const rateLimit = msgs.filter((m) => m.type === 'rate_limit_event').map((m) => ({ type: m.rate_limit_info?.rateLimitType, utilization: m.rate_limit_info?.utilization, windows: Object.keys(m.rate_limit_info?.unifiedWindows ?? {}) }));
  const last = results.at(-1) ?? {};
  const init = msgs.find((m) => m.type === 'system' && m.subtype === 'init') ?? {};
  // One API response can be streamed as several assistant messages; keep the last usage per message id.
  const byId = new Map();
  const agentCalls = [];
  for (const m of msgs) {
    if (m.type !== 'assistant') continue;
    const sub = Boolean(m.parent_tool_use_id);
    byId.set(m.message.id, { sub, model: m.message.model, u: m.message.usage ?? {} });
    if (!sub) for (const c of m.message.content ?? []) if (c.type === 'tool_use' && c.name === 'Agent') agentCalls.push({ type: c.input.subagent_type ?? 'general-purpose', model: c.input.model ?? null, effort: c.input.effort ?? null });
  }
  const tokens = {}; // "main|claude-opus-5-5" -> {in, out, cacheRead, cacheWrite, calls}
  for (const { sub, model, u } of byId.values()) {
    const k = `${sub ? 'sub' : 'main'}|${model}`;
    const t = (tokens[k] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
    t.input += u.input_tokens ?? 0; t.output += u.output_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0; t.cacheWrite += u.cache_creation_input_tokens ?? 0; t.calls++;
  }
  return {
    costUsd: Math.max(0, ...results.map((r) => r.total_cost_usd ?? 0)),
    apiMs: Math.max(0, ...results.map((r) => r.duration_api_ms ?? 0)),
    resultTurns: results.reduce((a, r) => a + (r.num_turns ?? 0), 0),
    subtype: last.subtype ?? 'none', terminal: last.terminal_reason ?? null,
    modelUsage: last.modelUsage ?? {}, subagentStats: last.subagent_stats ?? null,
    plugins: (init.plugins ?? []).map((p) => p.name).filter((n) => !n.startsWith('cc-plugin-')),
    mainModel: init.model ?? null, agentCalls, tokens, rateLimit,
    mainCalls: [...byId.values()].filter((x) => !x.sub).length, subCalls: [...byId.values()].filter((x) => x.sub).length,
  };
}

function readSubagents(cfg) {
  // What actually ran: model and API effort per sub-agent, from the session transcripts on disk.
  const found = [];
  const walk = (d) => fs.existsSync(d) && fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.meta.json') && found.push(path.join(d, e.name))));
  walk(path.join(cfg, 'projects'));
  return found.map((f) => {
    const meta = JSON.parse(fs.readFileSync(f, 'utf8'));
    const tx = fs.readFileSync(f.replace('.meta.json', '.jsonl'), 'utf8');
    const efforts = [...new Set([...tx.matchAll(/"output_config":\{"effort":"(\w+)"\}/g)].map((m) => m[1]))];
    const models = new Set();
    for (const line of tx.split('\n')) { try { const o = JSON.parse(line); if (o.type === 'assistant' && o.message?.model) models.add(o.message.model); } catch { /* not JSON */ } }
    return { type: meta.agentType, requestedModel: meta.model ?? null, requestedEffort: meta.effort ?? null, usedModels: [...models], usedEfforts: efforts };
  });
}

export function check(workdir) {
  let tampered = false;
  try { execFileSync('diff', ['-rq', path.join(FIXTURE, 'test'), path.join(workdir, 'test')], { stdio: 'pipe' }); } catch { tampered = true; }
  fs.rmSync(path.join(workdir, 'test'), { recursive: true, force: true });
  fs.cpSync(path.join(FIXTURE, 'test'), path.join(workdir, 'test'), { recursive: true });
  let out = ''; let ok = true;
  try { out = execFileSync('node', ['--test'], { cwd: workdir, stdio: 'pipe', env: { PATH: process.env.PATH } }).toString(); } catch (e) { ok = false; out = String(e.stdout ?? ''); }
  const n = (k) => Number((out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) ?? out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [])[1] ?? NaN);
  return { passed: ok, testsPass: n('pass'), testsFail: n('fail'), testsModified: tampered };
}

async function benchmark() {
  const runs = Number(arg('runs', 3)); const model = arg('model', 'opus'); const scenario = arg('scenario', 'natural');
  if (!PROMPTS[scenario]) throw new Error(`scenario must be one of ${Object.keys(PROMPTS)}`);
  const budget = Number(arg('budget', 5)); const cap = Number(arg('cap', 25));
  const stopWeekly = Number(arg('stop-weekly', 0)); const settleS = Number(arg('settle', 15)); // stop if the weekly limit is this % used; wait before the after-reading
  const arms = arg('arms', 'A,B').split(','); const tag = arg('tag', ''); // --arms B reruns only the plugin arm; --tag labels the plugin version

  const outDir = path.resolve(arg('out', path.join(os.tmpdir(), 'mr-bench-results')));
  fs.mkdirSync(outDir, { recursive: true });
  const resultsFile = path.join(outDir, 'results.json');
  const all = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : [];
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-bench-')) + '/fixture';
  let spent = all.reduce((a, r) => a + r.costUsd, 0);
  const cleanup = [];
  const bye = () => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); };
  process.on('SIGINT', () => { bye(); process.exit(130); });
  try {
    for (let i = 1; i <= runs; i++) {
      for (const arm of arms) { // interleaved so cache and time-of-day effects hit both arms alike
        if (spent + budget > cap) { console.log(`Stopping: spent $${fmt(spent)} and the next run could take $${budget}; cap is $${cap}.`); return; }
        const usageBefore = readUsage();
        if (stopWeekly && usageBefore.weekly >= stopWeekly) { console.log(`Stopping: weekly limit is ${usageBefore.weekly}% used (guard ${stopWeekly}%).`); return; }
        console.log(`run ${scenario} ${arm}${i} ... (weekly ${usageBefore.weekly}% used)`);
        const cfgs = makeConfig(arm); cleanup.push(cfgs.home);
        fs.rmSync(path.dirname(workdir), { recursive: true, force: true });
        fs.cpSync(FIXTURE, workdir, { recursive: true });
        const outFile = path.join(outDir, `${scenario}-${arm}${i}.stream.jsonl`);
        const t0 = Date.now();
        const proc = await runClaude(cfgs, workdir, { model, budget, maxTurns: 40, outFile, prompt: PROMPTS[scenario] });
        const wallS = ((proc.idleKilled ? proc.lastOutAt : Date.now()) - t0) / 1000;
        await new Promise((r) => setTimeout(r, settleS * 1000));
        const usageAfter = readUsage();
        const parsed = parseStream(outFile);
        const rec = { scenario, tag, arm, usage: { weeklyBefore: usageBefore.weekly, weeklyAfter: usageAfter.weekly, before: usageBefore.at, after: usageAfter.at, fiveHour: usageAfter.session5h }, run: i, model, wallS, exit: proc.code ?? proc.signal, idleKilled: proc.idleKilled, stderr: proc.err, ...parsed, subagents: readSubagents(cfgs.cfg), ...check(workdir) };
        all.push(rec); spent += rec.costUsd;
        fs.writeFileSync(resultsFile, JSON.stringify(all, null, 2));
        fs.rmSync(cfgs.home, { recursive: true, force: true });
        console.log(`  ${rec.passed ? 'PASS' : 'FAIL'} cost $${fmt(rec.costUsd)} ${fmt(wallS, 0)}s sub-agents ${rec.agentCalls.length} weekly ${usageBefore.weekly}% -> ${usageAfter.weekly}% total spent $${fmt(spent)}`);
      }
    }
  } finally { bye(); }
}

// Price weights, opus = 1: the input-token rate each model's total_cost_usd implies (about $0.10, $1.80 and $3.60 per
// million tokens for haiku, sonnet and opus; fitted from this benchmark's own runs, haiku exact, opus within about 6%).
const WEIGHT = (model) => (/haiku/.test(model) ? 0.1 / 3.6 : /sonnet/.test(model) ? 1.8 / 3.6 : 1);
const weightedTokens = (r) => Object.entries(r.modelUsage).reduce((a, [m, v]) => a + WEIGHT(m) * (v.inputTokens + v.outputTokens + v.cacheReadInputTokens + v.cacheCreationInputTokens), 0);

function summarize(file) {
  const all = JSON.parse(fs.readFileSync(file, 'utf8')).map((r) => ({ scenario: 'natural', ...r })).map((r) => ({ ...r, scenario: r.tag ? `${r.scenario} (${r.tag})` : r.scenario }));
  const stat = (xs) => `${fmt(mean(xs))} (${fmt(Math.min(...xs))} to ${fmt(Math.max(...xs))})`;
  const split = (r, side, re) => Object.entries(r.tokens).filter(([k]) => k.startsWith(side + '|') && re.test(k)).reduce((a, [, t]) => a + t.input + t.output + t.cacheRead + t.cacheWrite, 0);
  const rs0 = (a, sc) => a.filter((r) => r.scenario === sc);
  const sum = (xs) => (xs.some(Number.isNaN) ? 'n/a' : xs.reduce((a, b) => a + b, 0));
  const costOf = (r, re) => Object.entries(r.modelUsage).filter(([k]) => re.test(k)).reduce((a, [, v]) => a + v.costUSD, 0);
  for (const scenario of [...new Set(all.map((r) => r.scenario))]) {
    const rows = {};
    for (const arm of ['A', 'B']) {
      const rs = all.filter((r) => r.scenario === scenario && r.arm === arm);
      if (!rs.length) continue;
      rows[arm] = {
        n: rs.length, passed: rs.filter((r) => r.passed).length,
        wtok: rs.map((r) => weightedTokens(r) / 1e3), pts: rs.map((r) => (r.usage?.weeklyAfter ?? NaN) - (r.usage?.weeklyBefore ?? NaN)),
        cost: rs.map((r) => r.costUsd), costOpus: rs.map((r) => costOf(r, /opus/)), costCheap: rs.map((r) => costOf(r, /haiku|sonnet/)), wall: rs.map((r) => r.wallS), turns: rs.map((r) => r.mainCalls), subs: rs.map((r) => r.agentCalls.length),
        mainTok: rs.map((r) => split(r, 'main', /./) / 1e3), opusSub: rs.map((r) => split(r, 'sub', /opus/) / 1e3), cheapSub: rs.map((r) => split(r, 'sub', /haiku|sonnet/) / 1e3),
      };
    }
    const lines = [`\n### Scenario: ${scenario}\n`, '| | A: no plugin | B: model-router |', '|---|---|---|'];
    const row = (label, key) => lines.push(`| ${label} | ${rows.A ? stat(rows.A[key]) : '-'} | ${rows.B ? stat(rows.B[key]) : '-'} |`);
    lines.push(`| Runs passed | ${rows.A?.passed}/${rows.A?.n} | ${rows.B?.passed}/${rows.B?.n} |`);
    const hasUsage = rs0(all, scenario).some((r) => r.usage);
    if (hasUsage) {
      lines.push(`| Weekly limit, points used (sum over runs, from /usage) | ${rows.A ? sum(rows.A.pts) : '-'} | ${rows.B ? sum(rows.B.pts) : '-'} |`);
    }
    row('Weighted tokens, k opus-equivalent', 'wtok');
    row('Cost, USD', 'cost'); row('  of which opus', 'costOpus'); row('  of which haiku/sonnet', 'costCheap'); row('Wall time, s', 'wall'); row('Main-agent API calls', 'turns'); row('Sub-agents started', 'subs');
    row('Main-agent tokens, k', 'mainTok'); row('Sub-agent tokens on opus, k', 'opusSub'); row('Sub-agent tokens on haiku/sonnet, k', 'cheapSub');
    console.log(lines.join('\n'));
    if (rows.A && rows.B) console.log(`\nMean cost change B vs A: ${fmt(((mean(rows.B.cost) - mean(rows.A.cost)) / mean(rows.A.cost)) * 100, 1)}%`);
  }
  const withUsage = all.filter((r) => r.usage?.weeklyBefore != null);
  if (withUsage.length) {
    const first = withUsage[0].usage.weeklyBefore, last = withUsage.at(-1).usage.weeklyAfter, cost = withUsage.reduce((a, r) => a + r.costUsd, 0);
    console.log(`\nUsage batch (${withUsage.length} runs): weekly limit ${first}% -> ${last}% (${last - first} points), $${fmt(cost)} list-equivalent, ${fmt(withUsage.reduce((a, r) => a + weightedTokens(r), 0) / 1e6)}M weighted tokens`);
  }
  console.log(`\nTotal spent: $${fmt(all.reduce((a, r) => a + r.costUsd, 0))}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--summarize')) summarize(path.resolve(arg('summarize')));
  else await benchmark();
}
