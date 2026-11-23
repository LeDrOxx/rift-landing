#!/usr/bin/env bash
# Builds the demo project the screenshots use: a small coffee-shop web app at ~/Workspace/shop
# (inside Rift's allowed roots) with a believable git history and an uncommitted "promo code"
# change, so Rift's Changes tab, history graph, services and web preview all show real data.
# Re-running wipes and rebuilds it.
set -euo pipefail

SHOP="${SHOP:-$HOME/Workspace/shop}"
ORIGIN="$(cd "$(dirname "$0")" && pwd)/.origin.git"

rm -rf "$SHOP" "$ORIGIN"
mkdir -p "$SHOP/src" "$SHOP/test" "$SHOP/.rift"
cd "$SHOP"

export GIT_AUTHOR_NAME="Sam Rivera" GIT_AUTHOR_EMAIL="sam@example.com"
export GIT_COMMITTER_NAME="Sam Rivera" GIT_COMMITTER_EMAIL="sam@example.com"
git init -q -b main
git config commit.gpgsign false

# commit "<message>" "<days ago>"
commit() {
  local when; when="$(date -v-"$2"d -v-"$3"H '+%Y-%m-%dT%H:%M:%S')"
  git add -A
  GIT_AUTHOR_DATE="$when" GIT_COMMITTER_DATE="$when" git commit -q -m "$1"
}

# ---------------------------------------------------------------- base files
cat > package.json <<'EOF'
{
  "name": "shop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node dev-server.mjs",
    "test": "node --test"
  }
}
EOF

cat > .rift/services.json <<'EOF'
{ "services": [{ "name": "web", "command": ["node", "dev-server.mjs"], "url": "http://localhost:5173" }] }
EOF

cat > dev-server.mjs <<'EOF'
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/html', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(5173, () => console.log('\n  ➜  Local:   http://localhost:5173/\n'));
EOF

cat > .gitignore <<'EOF'
node_modules/
.DS_Store
EOF

cat > README.md <<'EOF'
# Northwind Coffee

Storefront for Northwind Coffee roasters. `npm run dev`, then open http://localhost:5173.
EOF

cat > src/cart.js <<'EOF'
export const cart = [
  { id: 'guji', name: 'Ethiopia Guji', note: 'Whole bean · 250 g', price: 18.5, qty: 1 },
  { id: 'huila', name: 'Colombia Huila', note: 'Ground for filter · 250 g', price: 16, qty: 1 },
  { id: 'filters', name: 'Paper filters', note: 'Pack of 100', price: 7.5, qty: 1 },
];

export const subtotal = (items) => items.reduce((sum, i) => sum + i.price * i.qty, 0);
EOF

cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Northwind Coffee</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="top"><span class="brand">Northwind<b>.</b></span><span class="bag">Bag · 3</span></header>
  <main class="checkout">
    <h1>Your bag</h1>
    <ul class="items" data-items></ul>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
EOF

cat > styles.css <<'EOF'
:root { --ink: #2b1d14; --muted: #8a7768; --line: #eadfd5; --bg: #faf6f1; --accent: #b4542b; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
.top { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--line); background: #fff; }
.brand { font-weight: 800; font-size: 20px; letter-spacing: -.02em; }
.brand b { color: var(--accent); }
.bag { font-size: 14px; color: var(--muted); }
.checkout { max-width: 520px; margin: 0 auto; padding: 22px; }
h1 { font-size: 28px; letter-spacing: -.02em; margin: 6px 0 16px; }
.items { list-style: none; margin: 0 0 18px; padding: 0; }
.items li { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.thumb { width: 52px; height: 52px; border-radius: 12px; flex: none; }
.thumb.guji { background: linear-gradient(135deg, #c9773f, #6b3518); }
.thumb.huila { background: linear-gradient(135deg, #8c5a3c, #3b2216); }
.thumb.filters { background: linear-gradient(135deg, #f1e7dc, #d8c5b3); }
.meta { flex: 1; display: flex; flex-direction: column; }
.meta small { color: var(--muted); font-size: 13px; }
.price { font-weight: 600; }
EOF

cat > src/main.js <<'EOF'
import { cart } from './cart.js';

const root = document.querySelector('.checkout');
root.querySelector('[data-items]').innerHTML = cart
  .map((i) => `<li><span class="thumb ${i.id}"></span><span class="meta"><b>${i.name}</b><small>${i.note}</small></span><span class="price">$${i.price.toFixed(2)}</span></li>`)
  .join('');
EOF
commit "Initial storefront" 12 6

cat >> styles.css <<'EOF'
@media (max-width: 420px) { .top { padding: 14px 18px; } h1 { font-size: 24px; } }
EOF
commit "Tighten header on small screens" 11 3

# ---------------------------------------------------------------- feature/checkout
git checkout -q -b feature/checkout
cat > src/checkout.js <<'EOF'
import { cart, subtotal } from './cart.js';

const fmt = (n) => `$${n.toFixed(2)}`;

export function totals(items, shipping = 4.5) {
  const sub = subtotal(items);
  return { sub, shipping, total: sub + shipping };
}

export function render(root) {
  const t = totals(cart);
  root.querySelector('[data-sub]').textContent = fmt(t.sub);
  root.querySelector('[data-ship]').textContent = fmt(t.shipping);
  root.querySelector('[data-total]').textContent = fmt(t.total);
}
EOF
cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Northwind Coffee · Checkout</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="top"><span class="brand">Northwind<b>.</b></span><span class="bag">Bag · 3</span></header>
  <main class="checkout">
    <h1>Checkout</h1>
    <ul class="items" data-items></ul>
    <dl class="sum">
      <div><dt>Subtotal</dt><dd data-sub></dd></div>
      <div><dt>Shipping</dt><dd data-ship></dd></div>
      <div class="total"><dt>Total</dt><dd data-total></dd></div>
    </dl>
    <button class="pay">Place order</button>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
EOF
cat >> styles.css <<'EOF'
.sum { margin: 0 0 20px; }
.sum div { display: flex; justify-content: space-between; padding: 5px 0; color: var(--muted); }
.sum dd { margin: 0; color: var(--ink); }
.sum .total { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 12px; font-weight: 700; font-size: 18px; color: var(--ink); }
.pay { width: 100%; padding: 15px; border: 0; border-radius: 14px; background: var(--ink); color: #fff; font: 600 16px inherit; }
EOF
cat > src/main.js <<'EOF'
import { cart } from './cart.js';
import { render } from './checkout.js';

const root = document.querySelector('.checkout');
root.querySelector('[data-items]').innerHTML = cart
  .map((i) => `<li><span class="thumb ${i.id}"></span><span class="meta"><b>${i.name}</b><small>${i.note}</small></span><span class="price">$${i.price.toFixed(2)}</span></li>`)
  .join('');
render(root);
EOF
commit "Checkout summary with shipping" 9 5

cat >> src/checkout.js <<'EOF'

export const FREE_SHIPPING_FROM = 60;
EOF
commit "Free shipping threshold constant" 8 2

git checkout -q main
cat >> README.md <<'EOF'

## Tests

`npm test` runs the unit tests with Node's built-in runner.
EOF
commit "Document how to run tests" 8 1

when="$(date -v-7d -v-20H '+%Y-%m-%dT%H:%M:%S')"
GIT_AUTHOR_DATE="$when" GIT_COMMITTER_DATE="$when" git merge -q --no-ff feature/checkout -m "Merge branch 'feature/checkout'"
git tag -a v1.1.0 -m "Checkout" HEAD
git branch -q -d feature/checkout

# ---------------------------------------------------------------- feature/promo-codes
git checkout -q -b feature/promo-codes
cat > src/promo.js <<'EOF'
const CODES = { SAVE10: 10, WELCOME15: 15 };

/** Looks up a promo code (case-insensitive). Returns null for unknown codes. */
export function findPromo(raw) {
  const code = String(raw ?? '').trim().toUpperCase();
  return code in CODES ? { code, percent: CODES[code] } : null;
}
EOF
commit "Add promo code lookup" 1 4

# Remote, so the branch shows an upstream and "ahead".
git init -q --bare "$ORIGIN"
git remote add origin "$ORIGIN"
git push -q origin main v1.1.0 2>/dev/null
git push -q -u origin feature/promo-codes 2>/dev/null

# ---------------------------------------------------------------- uncommitted: the change Claude made
cat > src/checkout.js <<'EOF'
import { cart, subtotal } from './cart.js';
import { findPromo } from './promo.js';

const fmt = (n) => `$${n.toFixed(2)}`;

export function totals(items, shipping = 4.5, promo = null) {
  const sub = subtotal(items);
  const discount = promo ? Math.round(sub * promo.percent) / 100 : 0;
  return { sub, shipping, discount, total: sub - discount + shipping };
}

export function render(root, promo = null) {
  const t = totals(cart, 4.5, promo);
  root.querySelector('[data-sub]').textContent = fmt(t.sub);
  root.querySelector('[data-discount]').textContent = t.discount ? `−${fmt(t.discount)}` : '—';
  root.querySelector('[data-ship]').textContent = fmt(t.shipping);
  root.querySelector('[data-total]').textContent = fmt(t.total);
}

export function bindPromo(root) {
  const input = root.querySelector('#promo');
  const note = root.querySelector('[data-promo-note]');
  const apply = () => {
    const promo = findPromo(input.value);
    note.textContent = promo ? `${promo.code} applied: ${promo.percent}% off` : input.value ? "That code isn't valid" : '';
    note.classList.toggle('error', !promo && !!input.value);
    render(root, promo);
  };
  root.querySelector('#apply-promo').addEventListener('click', apply);
  apply();
}

export const FREE_SHIPPING_FROM = 60;
EOF

cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Northwind Coffee · Checkout</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="top"><span class="brand">Northwind<b>.</b></span><span class="bag">Bag · 3</span></header>
  <main class="checkout">
    <h1>Checkout</h1>
    <ul class="items" data-items></ul>
    <div class="promo">
      <label for="promo">Promo code</label>
      <div class="promo-row"><input id="promo" value="SAVE10" autocomplete="off" /><button id="apply-promo">Apply</button></div>
      <p class="promo-note" data-promo-note></p>
    </div>
    <dl class="sum">
      <div><dt>Subtotal</dt><dd data-sub></dd></div>
      <div class="discount"><dt>Discount</dt><dd data-discount></dd></div>
      <div><dt>Shipping</dt><dd data-ship></dd></div>
      <div class="total"><dt>Total</dt><dd data-total></dd></div>
    </dl>
    <button class="pay">Place order</button>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
EOF

sed -i '' 's/^import { render } from/import { render, bindPromo } from/; s/^render(root);$/bindPromo(root);/' src/main.js

cat >> styles.css <<'EOF'
.promo { margin: 0 0 18px; }
.promo label { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
.promo-row { display: flex; gap: 8px; }
.promo-row input { flex: 1; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; font: 600 15px inherit; letter-spacing: .04em; background: #fff; }
.promo-row button { padding: 0 18px; border: 0; border-radius: 12px; background: var(--accent); color: #fff; font: 600 15px inherit; }
.promo-note { margin: 8px 0 0; font-size: 13px; color: #2f7d4f; min-height: 1em; }
.promo-note.error { color: #b3261e; }
.sum .discount dd { color: #2f7d4f; font-weight: 600; }
EOF

cat > test/checkout.test.js <<'EOF'
import test from 'node:test';
import assert from 'node:assert/strict';
import { totals } from '../src/checkout.js';
import { findPromo } from '../src/promo.js';

const items = [{ price: 20, qty: 2 }, { price: 2, qty: 1 }];

test('no promo', () => assert.equal(totals(items).total, 46.5));
test('SAVE10 takes 10% off the subtotal', () => assert.equal(totals(items, 4.5, findPromo('save10')).discount, 4.2));
test('unknown codes are ignored', () => assert.equal(findPromo('NOPE'), null));
EOF

echo "Demo project ready at $SHOP"
git status --short
