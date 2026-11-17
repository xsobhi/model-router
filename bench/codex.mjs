#!/usr/bin/env node
// One Codex pair: the same task with and without the plugin, each in a throwaway CODEX_HOME and HOME.
// Only auth.json is copied into them (chmod 600) and both directories are deleted afterwards.
// Codex reports tokens, not dollars, so this compares tokens per thread (main thread vs sub-agent threads).
// Usage: node bench/codex.mjs [--scenario delegate] [--out /tmp/mr-bench/codex.json]
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROMPTS, FIXTURE, REPO, check } from './run.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const scenario = arg('scenario', 'delegate');
const outFile = path.resolve(arg('out', '/tmp/mr-bench/codex.json'));

function threads(codexHome) {
  const files = [];
  const walk = (d) => fs.existsSync(d) && fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.jsonl') && files.push(path.join(d, e.name))));
  walk(path.join(codexHome, 'sessions'));
  return files.map((f) => {
    const t = { source: null, started: null, models: new Set(), efforts: new Set(), usage: null, spawns: [] };
    for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
      let m; try { m = JSON.parse(line); } catch { continue; }
      const p = m.payload ?? {};
      if (m.type === 'session_meta') { t.source = JSON.stringify(p.source ?? p.thread_source); t.started = p.timestamp; }
      if (p.type === 'function_call' && /spawn/.test(p.name ?? '')) t.spawns.push({ name: p.name, arguments: String(p.arguments ?? '').slice(0, 600) });
      if (m.type === 'turn_context') { t.models.add(p.model); t.efforts.add(p.effort ?? p.collaboration_mode?.settings?.reasoning_effort ?? 'default'); }
      if (p.type === 'token_count' && p.info?.total_token_usage) t.usage = p.info.total_token_usage;
    }
    return { source: t.source, started: t.started, models: [...t.models], efforts: [...t.efforts], usage: t.usage, spawns: t.spawns };
  }).sort((a, b) => String(a.started).localeCompare(String(b.started))); // first thread = the main agent
}

async function run(arm) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-codex-'));
  const codexHome = path.join(home, 'codex');
  fs.mkdirSync(codexHome, { mode: 0o700 });
  const auth = path.join(process.env.CODEX_AUTH_HOME ?? path.join(os.homedir(), '.codex'), 'auth.json');
  fs.copyFileSync(auth, path.join(codexHome, 'auth.json'));
  fs.chmodSync(path.join(codexHome, 'auth.json'), 0o600);
  const env = { PATH: process.env.PATH, HOME: home, CODEX_HOME: codexHome, LANG: 'C.UTF-8' };
  try {
    if (arm === 'B') {
      execFileSync('codex', ['plugin', 'marketplace', 'add', REPO], { env, cwd: home, stdio: 'pipe' });
      execFileSync('codex', ['plugin', 'add', 'model-router@model-router'], { env, cwd: home, stdio: 'pipe' });
    }
    const workdir = path.join(home, 'fixture');
    fs.cpSync(FIXTURE, workdir, { recursive: true });
    // Hook-trust bypass: the plugin's hooks are untrusted in a fresh CODEX_HOME. Sandbox bypass: bwrap does not start on some VMs. Both flags go to both arms; the workdir is a throwaway copy.
    const args = ['exec', '--json', '--skip-git-repo-check', '--dangerously-bypass-hook-trust', '--dangerously-bypass-approvals-and-sandbox', '-C', workdir, PROMPTS[scenario]];
    const t0 = Date.now();
    const events = await new Promise((resolve) => {
      let buf = '';
      const p = spawn('codex', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      p.stdout.on('data', (d) => (buf += d));
      const timer = setTimeout(() => p.kill('SIGKILL'), 30 * 60 * 1000);
      p.on('close', () => { clearTimeout(timer); resolve(buf.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)); });
    });
    const wallS = (Date.now() - t0) / 1000;
    fs.writeFileSync(outFile.replace(/\.json$/, `-${arm}.events.jsonl`), events.map((e) => JSON.stringify(e)).join('\n'));
    return { arm, scenario, wallS, threads: threads(codexHome), ...check(workdir) };
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

const results = [];
for (const arm of ['A', 'B']) {
  console.log(`codex run ${arm} ...`);
  const r = await run(arm);
  results.push(r);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  const tok = r.threads.reduce((a, t) => a + (t.usage?.total_tokens ?? 0), 0);
  console.log(`  ${r.passed ? 'PASS' : 'FAIL'} ${r.wallS.toFixed(0)}s threads ${r.threads.length} total tokens ${tok}`);
}
