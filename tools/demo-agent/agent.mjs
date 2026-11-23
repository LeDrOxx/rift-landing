// Demo agent for landing-page screenshots.
//
// Listens on ws://127.0.0.1:7979/ws and speaks the Rift protocol (rift/protocol/PROTOCOL.md).
// Everything is proxied to the real Rift agent on 127.0.0.1:7878, so git, diffs, dev servers,
// the Chrome preview and simulator/emulator video are real. Only what would show personal data
// or cost Claude quota is replaced: the chat transcript, plan usage, project list, Mac name and
// account. Pair the Rift app (in a simulator) with: rift://pair?host=127.0.0.1:7979&code=DEMO
//
//   node agent.mjs            start (pairs itself with the real agent on first run)
//   rift revoke <id>          afterwards, remove the "Rift demo" device it added

import { request } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DEMO_PORT ?? 7979);
const UPSTREAM = `ws://127.0.0.1:${process.env.RIFT_PORT ?? 7878}/ws`;
const TOKEN_FILE = join(HERE, '.token');
const HOME = homedir();
const SHOP = join(HOME, 'Workspace', 'shop');
const now = () => Date.now();
const min = 60_000, hour = 60 * min, day = 24 * hour;

// Commit ages in the shots are relative to when make-shop.sh built the repo; shift commit times
// by how long ago that was so a retake shows the same "7d ago" without rebuilding (new hashes).
const ORIGIN = join(HERE, '.origin.git');
const BUILT_AT = existsSync(ORIGIN) ? statSync(ORIGIN).birthtimeMs : now();

// Fixed Mac stats so the home screen looks the same on every retake.
const systemStats = () => ({ battery: { percent: 100, charging: false, plugged: false, minutesLeft: 16 * 60 + 56 }, net: { rxBps: 5 * 1024, txBps: 38 * 1024 }, cpu: 15, temp: { cpuC: 51, state: 'nominal' }, ts: now() });

// ------------------------------------------------------------------ upstream auth

function adminRequest(path) {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath: join(HOME, '.rift', 'admin.sock'), path, method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`${path}: HTTP ${res.statusCode} ${body}`))));
    });
    req.on('error', reject);
    req.end('{}');
  });
}

function rpcOnce(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMsg = (raw) => {
      const m = JSON.parse(String(raw));
      if (m.id !== id) return;
      ws.off('message', onMsg);
      m.error ? reject(new Error(`${m.error.code}: ${m.error.message}`)) : resolve(m.result);
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}

async function upstreamToken() {
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf8').trim();
  const { code } = await adminRequest('/pair-code');
  const ws = new WebSocket(UPSTREAM);
  await new Promise((r, j) => (ws.once('open', r), ws.once('error', j)));
  await rpcOnce(ws, 'hello', { protocolVersion: 1 });
  const { token, deviceId } = await rpcOnce(ws, 'pair.claim', { code, deviceName: 'Rift demo (screenshots)' });
  ws.close();
  writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  console.log(`Paired with the real agent as device ${deviceId}. Remove it later with: rift revoke ${deviceId}`);
  return token;
}

// ------------------------------------------------------------------ fake data

const projects = [
  { path: SHOP, name: 'shop', kind: 'web', branch: 'feature/promo-codes', dirty: true, lastOpened: now() - 3 * min, source: 'rift', lastSessionId: 'demo-promo' },
  { path: join(HOME, 'Workspace', 'fitness_app'), name: 'fitness_app', kind: 'flutter', branch: 'main', dirty: false, lastOpened: now() - 5 * hour, source: 'rift' },
  { path: join(HOME, 'Workspace', 'orders-api'), name: 'orders-api', kind: 'node', branch: 'main', dirty: false, lastOpened: now() - 1 * day, source: 'rift' },
  { path: join(HOME, 'Workspace', 'TravelLog'), name: 'TravelLog', kind: 'native', branch: 'release/2.3', dirty: false, lastOpened: now() - 3 * day, source: 'rift' },
];

const sessionSettings = { model: 'opus', activeModel: 'claude-opus-5-5', effort: 'high', permissionMode: 'default' };

const shopSessions = [
  { id: 'demo-promo', title: 'Promo code field at checkout', state: 'waiting', updatedAt: now() - 1 * min },
  { id: 'demo-shipping', title: 'Free shipping banner', state: 'idle', updatedAt: now() - 2 * hour },
  { id: 'demo-a11y', title: 'Fix contrast on product cards', state: 'idle', updatedAt: now() - 1 * day },
].map((s) => ({ ...s, project: SHOP, origin: 'rift', createdAt: s.updatedAt - hour, settings: sessionSettings }));

const homeChats = [
  { id: 'demo-chat-1', title: 'Explain this stack trace from Sentry', updatedAt: now() - 40 * min },
  { id: 'demo-chat-2', title: 'Draft release notes for v1.1', updatedAt: now() - 6 * hour },
].map((s) => ({ ...s, project: HOME, state: 'idle', origin: 'rift', createdAt: s.updatedAt, settings: sessionSettings }));

const f = (p) => join(SHOP, p);

const checkoutPatch = {
  path: 'src/checkout.js',
  added: 4,
  removed: 2,
  hunks: [
    {
      oldStart: 1,
      newStart: 1,
      lines: [
        " import { cart, subtotal } from './cart.js';",
        "+import { findPromo } from './promo.js';",
        ' ',
        ' const fmt = (n) => `$${n.toFixed(2)}`;',
        ' ',
        '-export function totals(items, shipping = 4.5) {',
        '+export function totals(items, shipping = 4.5, promo = null) {',
        '   const sub = subtotal(items);',
        '-  return { sub, shipping, total: sub + shipping };',
        '+  const discount = promo ? Math.round(sub * promo.percent) / 100 : 0;',
        '+  return { sub, shipping, discount, total: sub - discount + shipping };',
        ' }',
      ],
    },
  ],
};

const htmlPatch = {
  path: 'index.html',
  added: 6,
  removed: 0,
  hunks: [
    {
      oldStart: 13,
      newStart: 13,
      lines: [
        '     <ul class="items" data-items></ul>',
        '+    <div class="promo">',
        '+      <label for="promo">Promo code</label>',
        '+      <div class="promo-row"><input id="promo" autocomplete="off" /><button id="apply-promo">Apply</button></div>',
        '+      <p class="promo-note" data-promo-note></p>',
        '+    </div>',
        '     <dl class="sum">',
        '       <div><dt>Subtotal</dt><dd data-sub></dd></div>',
        '+      <div class="discount"><dt>Discount</dt><dd data-discount></dd></div>',
        '       <div><dt>Shipping</dt><dd data-ship></dd></div>',
      ],
    },
  ],
};

const testPatch = {
  path: 'test/checkout.test.js',
  added: 10,
  removed: 0,
  created: true,
  hunks: [
    {
      oldStart: 0,
      newStart: 1,
      lines: [
        "+import test from 'node:test';",
        "+import assert from 'node:assert/strict';",
        "+import { totals } from '../src/checkout.js';",
        "+import { findPromo } from '../src/promo.js';",
        '+',
        '+const items = [{ price: 20, qty: 2 }, { price: 2, qty: 1 }];',
        '+',
        "+test('no promo', () => assert.equal(totals(items).total, 46.5));",
        "+test('SAVE10 takes 10% off the subtotal', () => assert.equal(totals(items, 4.5, findPromo('save10')).discount, 4.2));",
        "+test('unknown codes are ignored', () => assert.equal(findPromo('NOPE'), null));",
      ],
    },
  ],
};

const transcripts = {
  'demo-promo': [
    { kind: 'user', text: 'Add a promo code field to checkout. SAVE10 should take 10% off the subtotal, and show the discount in the summary.' },
    { kind: 'assistant', text: "I'll check how checkout totals work and whether there's already a promo lookup." },
    { kind: 'tool', id: 't1', name: 'Read', input: { file_path: f('src/checkout.js') }, output: '15 lines' },
    { kind: 'tool', id: 't2', name: 'Read', input: { file_path: f('src/promo.js') }, output: '7 lines' },
    { kind: 'assistant', text: '`findPromo()` already exists on this branch, so I just need to wire it into the totals and the page.' },
    { kind: 'tool', id: 't3', name: 'Edit', input: { file_path: f('src/checkout.js') }, output: 'Updated src/checkout.js', patch: checkoutPatch },
    { kind: 'tool', id: 't4', name: 'Edit', input: { file_path: f('index.html') }, output: 'Updated index.html', patch: htmlPatch },
    { kind: 'tool', id: 't5', name: 'Write', input: { file_path: f('test/checkout.test.js') }, output: 'Created test/checkout.test.js', patch: testPatch },
    {
      kind: 'tool',
      id: 't6',
      name: 'Bash',
      input: { command: 'npm test', description: 'Run unit tests' },
      output: '✔ no promo (0.4ms)\n✔ SAVE10 takes 10% off the subtotal (0.1ms)\n✔ unknown codes are ignored (0.1ms)\nℹ tests 3\nℹ pass 3\nℹ fail 0',
    },
    {
      kind: 'assistant',
      text:
        'Done. Checkout now has a **Promo code** field:\n\n' +
        '- `totals()` takes the promo and subtracts the discount before shipping\n' +
        '- The summary shows a **Discount** row, and unknown codes show an inline error\n' +
        '- Codes are case-insensitive (`save10` works)\n\n' +
        'All 3 tests pass. With the sample bag, SAVE10 takes **$4.20** off, for a total of **$42.30**.',
    },
    { kind: 'user', text: 'Looks great on the emulator. Run the e2e tests too' },
  ],
};

const pending = {
  'demo-promo': [
    {
      type: 'permission.request',
      id: 'perm-e2e',
      kind: 'permission',
      toolName: 'Bash',
      input: { command: 'npm run test:e2e -- --project=mobile', description: 'Run end-to-end tests on the mobile viewport' },
      canAlways: true,
    },
  ],
};

// Screenshots show no plan name or plan usage (see README: Anthropic branding/auth policy).
// Set DEMO_SHOW_PLAN=1 to bring them back for internal testing.
const SHOW_PLAN = process.env.DEMO_SHOW_PLAN === '1';
const usage = () => (!SHOW_PLAN ? { available: false, windows: [], fetchedAt: now() } : {
  available: true,
  subscription: 'max',
  extraUsageEnabled: false,
  fetchedAt: now(),
  windows: [
    { key: 'five_hour', label: '5-hour', usedPercent: 34, resetsAt: now() + 2 * hour + 14 * min, severity: 'ok' },
    { key: 'seven_day', label: 'Weekly', usedPercent: 21, resetsAt: now() + 4 * day, severity: 'ok' },
  ],
});

const models = [
  { value: 'default', displayName: 'Default (recommended)', description: 'Opus 5.5 for most tasks', resolvedModel: 'claude-opus-5-5', supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { value: 'opus', displayName: 'Opus', description: 'Most capable for complex work', resolvedModel: 'claude-opus-5-5', supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { value: 'sonnet', displayName: 'Sonnet', description: 'Fast and capable for everyday tasks', resolvedModel: 'claude-sonnet-5-5', supportedEffortLevels: ['low', 'medium', 'high'] },
  { value: 'haiku', displayName: 'Haiku', description: 'Fastest for quick answers', resolvedModel: 'claude-haiku-5-5' },
];

const commands = [
  { name: 'review', description: 'Review the current changes', argumentHint: '' },
  { name: 'init', description: 'Create a CLAUDE.md for this project', argumentHint: '' },
  { name: 'compact', description: 'Summarize the conversation to save context', argumentHint: '' },
];

const allSessions = [...shopSessions, ...homeChats];

// Times above are relative to when the agent started; keep them relative to the request instead,
// so "40m ago" stays "40m ago" however long the agent has been running.
const STARTED = now();
const fresh = (list, ...keys) => list.map((x) => {
  const y = { ...x };
  for (const k of keys.length ? keys : ['updatedAt', 'createdAt']) if (typeof y[k] === 'number') y[k] += now() - STARTED;
  return y;
});
const isDemoSession = (id) => typeof id === 'string' && id.startsWith('demo-');
const summary = (id) => allSessions.find((s) => s.id === id) ?? { ...shopSessions[0], id, title: 'New chat', state: 'idle' };

// ------------------------------------------------------------------ per-phone connection

let demoSettings = null;

function overrideHello(up) {
  demoSettings ??= { ...(up.settings ?? {}), previewMode: 'both', permissionMode: 'default', notifications: true, autoHotReload: true };
  const { tailscaleIp, ...rest } = up; // the app would switch to dialing this IP on our port
  return {
    ...rest,
    host: { ...(up.host ?? {}), name: 'MacBook Pro' },
    account: SHOW_PLAN ? { subscriptionType: 'Max', apiProvider: 'firstParty', email: 'sam@example.com', ok: true } : { ok: true },
    quota: { status: 'ok' },
    settings: demoSettings,
    claude: 'ready',
  };
}

class PhoneConn {
  constructor(phone, token) {
    this.phone = phone;
    this.token = token;
    this.up = null;
    this.upReady = null;
    this.nextUpId = 1;
    this.upCalls = new Map(); // upstream id -> phone id
    phone.on('message', (raw) => this.onPhone(raw));
    phone.on('close', () => this.up?.close());
  }

  send(obj) {
    if (this.phone.readyState === WebSocket.OPEN) this.phone.send(JSON.stringify(obj));
  }
  reply(id, result) {
    this.send({ jsonrpc: '2.0', id, result });
  }
  fail(id, code, message) {
    this.send({ jsonrpc: '2.0', id, error: { code, message } });
  }
  event(type, sessionId, data) {
    this.send({ jsonrpc: '2.0', method: 'event', params: { seq: 0, ts: now(), type, sessionId, project: SHOP, data } });
  }

  connectUp() {
    this.upReady ??= new Promise((resolve, reject) => {
      const up = new WebSocket(UPSTREAM);
      this.up = up;
      up.once('error', reject);
      up.once('open', async () => {
        up.on('message', (raw) => this.onUp(raw));
        try {
          const id = this.nextUpId++;
          const p = new Promise((r, j) => this.upCalls.set(id, { resolve: r, reject: j }));
          up.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'hello', params: { protocolVersion: 1, token: this.token } }));
          resolve(await p);
        } catch (e) {
          reject(e);
        }
      });
      up.on('close', () => this.phone.close());
    });
    return this.upReady;
  }

  forward(id, method, params) {
    const upId = this.nextUpId++;
    this.upCalls.set(upId, { phoneId: id, method });
    this.up.send(JSON.stringify({ jsonrpc: '2.0', id: upId, method, params }));
  }

  onUp(raw) {
    const m = JSON.parse(String(raw));
    if (m.id !== undefined && this.upCalls.has(m.id)) {
      const c = this.upCalls.get(m.id);
      this.upCalls.delete(m.id);
      if (c.resolve) return m.error ? c.reject(new Error(m.error.message)) : c.resolve(m.result);
      if (c.method === 'changes.log' && Array.isArray(m.result?.commits)) {
        const shift = now() - BUILT_AT;
        for (const commit of m.result.commits) if (typeof commit.ts === 'number') commit.ts += shift;
      }
      return this.send({ ...m, id: c.phoneId });
    }
    if (m.method === 'event') {
      const ev = m.params ?? {};
      if (ev.sessionId) return; // real chats
      if (['quota.state', 'usage.updated', 'settings.changed'].includes(ev.type)) return;
      if (ev.project && ev.project !== SHOP) return;
      return this.send(m);
    }
    this.send(m); // webrtc.signal, term.data, term.exit
  }

  async onPhone(raw) {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    const { id, method, params = {} } = m;
    try {
      const local = await this.local(method, params, id);
      if (local !== undefined) return id !== undefined && this.reply(id, local);
      await this.connectUp();
      this.forward(id, method, params);
    } catch (e) {
      if (id !== undefined) this.fail(id, 'DEMO', String(e?.message ?? e));
    }
  }

  /** Returns a result for methods the demo answers itself, undefined to proxy. */
  async local(method, p, id) {
    switch (method) {
      case 'hello':
        if (!p.token) return { paired: false, agentVersion: '0.1.9', protocolVersion: 1, host: { os: 'darwin', name: 'MacBook Pro' }, capabilities: [], claude: 'ready' };
        return overrideHello(await this.connectUp());
      case 'pair.claim':
        return { deviceId: 'demo-phone', token: 'demo' };
      case 'projects.list':
        return fresh(projects, 'lastOpened');
      case 'usage.get':
        return usage();
      case 'system.stats':
        return systemStats();
      case 'quota.get':
        return { status: 'ok' };
      case 'settings.get':
        return demoSettings;
      case 'settings.set':
        demoSettings = { ...demoSettings, ...p };
        return demoSettings;
      case 'devices.paired':
        return [{ id: 'demo-phone', name: 'iPhone', createdAt: now() - 30 * day, lastSeen: now() }];
      case 'session.list':
        return p.project === SHOP ? fresh(shopSessions) : p.project === HOME ? fresh(homeChats) : [];
      case 'session.resumeLast':
        if (p.project === SHOP) return { ...summary('demo-promo'), pending: pending['demo-promo'] };
        return undefined;
      case 'session.start':
        if (p.project === SHOP || p.project === HOME) return { ...summary('demo-new'), id: `demo-new-${now()}`, project: p.project, title: undefined, state: 'idle' };
        return undefined;
    }
    if (!method.startsWith('session.') && !method.startsWith('permission.') && !method.startsWith('question.')) return undefined;
    const sid = p.id ?? p.sessionId;
    if (!isDemoSession(sid)) return undefined;
    switch (method) {
      case 'session.open':
        return { ...summary(sid), pending: pending[sid] ?? [] };
      case 'session.transcript':
        return transcripts[sid] ?? [];
      case 'session.history':
        return [];
      case 'session.models':
        return models;
      case 'session.commands':
        return commands;
      case 'session.configure':
        Object.assign(sessionSettings, Object.fromEntries(Object.entries({ model: p.model, effort: p.effort, permissionMode: p.permissionMode }).filter(([, v]) => v !== undefined)));
        return sessionSettings;
      case 'session.interrupt':
      case 'session.close':
        return { ok: true };
      case 'session.send':
        setTimeout(() => this.fakeTurn(sid, p.text ?? ''), 50);
        return { ok: true };
      case 'permission.respond':
        delete pending[sid];
        setTimeout(() => this.fakeApproval(sid, p.id, p.decision), 50);
        return { ok: true };
      case 'question.answer':
      case 'question.decline':
        return { ok: true };
    }
    return { ok: true };
  }

  async stream(sid, text) {
    this.event('session.state', sid, { state: 'running' });
    let acc = '';
    for (const word of text.split(/(?<= )/)) {
      acc += word;
      this.event('assistant.delta', sid, { text: word });
      await new Promise((r) => setTimeout(r, 35));
    }
    this.event('assistant.message', sid, { text: acc });
    this.event('turn.result', sid, { subtype: 'success', isError: false, durationMs: 8200, turns: 3 });
    this.event('session.state', sid, { state: 'idle' });
  }

  async fakeTurn(sid, text) {
    this.event('user.message', sid, { text });
    await new Promise((r) => setTimeout(r, 600));
    await this.stream(sid, "Sure. I'll take a look at that now and keep the change small.");
  }

  async fakeApproval(sid, permId, decision) {
    this.event('permission.resolved', sid, { id: permId, behavior: decision === 'deny' ? 'deny' : 'allow' });
    if (decision === 'deny') return this.event('session.state', sid, { state: 'idle' });
    this.event('session.state', sid, { state: 'running' });
    this.event('tool.start', sid, { id: 't7', name: 'Bash', input: { command: 'npm run test:e2e -- --project=mobile', description: 'Run end-to-end tests on the mobile viewport' }, subagent: false });
    await new Promise((r) => setTimeout(r, 1500));
    this.event('tool.result', sid, { id: 't7', isError: false, output: '  ✓ checkout › applies SAVE10 (1.2s)\n  ✓ checkout › rejects unknown codes (0.8s)\n\n  2 passed (3.4s)', truncated: false });
    await this.stream(sid, 'Both end-to-end tests pass on the mobile viewport. Ready to commit when you are.');
  }
}

// ------------------------------------------------------------------ main

const token = await upstreamToken();
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT, path: '/ws' });
wss.on('connection', (ws) => new PhoneConn(ws, token));
console.log(`Rift demo agent on ws://127.0.0.1:${PORT}/ws (proxying ${UPSTREAM})`);
console.log(`Pair the app with: rift://pair?host=127.0.0.1:${PORT}&code=DEMO`);
