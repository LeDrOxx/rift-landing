// One-off RPC against the demo agent: node rpc.mjs <method> '<json params>'
import { WebSocket } from 'ws';
const [method, params = '{}'] = process.argv.slice(2);
const ws = new WebSocket('ws://127.0.0.1:7979/ws');
let n = 0;
const call = (m, p) => new Promise((res, rej) => {
  const id = ++n;
  ws.on('message', (raw) => { const r = JSON.parse(String(raw)); if (r.id === id) r.error ? rej(new Error(r.error.message)) : res(r.result); });
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: m, params: p }));
});
ws.on('open', async () => {
  try {
    await call('hello', { protocolVersion: 1, token: 'demo' });
    console.log(JSON.stringify(await call(method, JSON.parse(params)), null, 1));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  ws.close();
});
