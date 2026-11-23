// Taps a simulator/emulator through the Rift agent: node tap.mjs <deviceId> x,y [x,y …]
// (x and y are 0–1 of the screen). Also: "text:hello", "key:enter", "wait:800", "hold:x,y,ms", "drag:x1,y1,x2,y2".
import { WebSocket } from 'ws';
const [deviceId, ...steps] = process.argv.slice(2);
const ws = new WebSocket('ws://127.0.0.1:7979/ws');
let n = 0;
const call = (method, params) => new Promise((res, rej) => {
  const id = ++n;
  ws.on('message', (raw) => { const r = JSON.parse(String(raw)); if (r.id === id) r.error ? rej(new Error(r.error.message)) : res(r.result); });
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.on('open', async () => {
  try {
    await call('hello', { protocolVersion: 1, token: 'demo' });
    await call('stream.start', { deviceId, quality: 'balanced' });
    await sleep(1500);
    for (const s of steps) {
      if (s.startsWith('wait:')) { await sleep(Number(s.slice(5))); continue; }
      if (s.startsWith('text:')) { await call('stream.input', { event: { type: 'text', text: s.slice(5) } }); continue; }
      if (s.startsWith('key:')) { await call('stream.input', { event: { type: 'key', key: s.slice(4) } }); continue; }
      if (s.startsWith('drag:')) {
        const [x1, y1, x2, y2] = s.slice(5).split(',').map(Number);
        await call('stream.input', { event: { type: 'touch', action: 'down', x: x1, y: y1 } });
        for (let i = 1; i <= 12; i++) {
          await sleep(25);
          await call('stream.input', { event: { type: 'touch', action: 'move', x: x1 + ((x2 - x1) * i) / 12, y: y1 + ((y2 - y1) * i) / 12 } });
        }
        await sleep(150);
        await call('stream.input', { event: { type: 'touch', action: 'up', x: x2, y: y2 } });
        await sleep(900);
        continue;
      }
      if (s.startsWith('hold:')) {
        const [x, y, ms] = s.slice(5).split(',').map(Number);
        await call('stream.input', { event: { type: 'touch', action: 'down', x, y } });
        await sleep(ms);
        await call('stream.input', { event: { type: 'touch', action: 'up', x, y } });
        await sleep(500);
        continue;
      }
      const [x, y] = s.split(',').map(Number);
      await call('stream.input', { event: { type: 'touch', action: 'down', x, y } });
      await sleep(80);
      await call('stream.input', { event: { type: 'touch', action: 'up', x, y } });
      await sleep(700);
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  ws.close();
});
