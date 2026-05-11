# TATAR Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-file localStorage-based SchoolDash app into a multi-file Node.js/Express app with a shared JSON backend so orders sync across all devices on the local network.

**Architecture:** Express server serves static files from `public/` and exposes REST API endpoints. Data persisted to `data.json`. Frontend polls `/api/orders` every 5 seconds for real-time sync. Admin password validated server-side.

**Tech Stack:** Node.js, Express, vanilla JS/CSS/HTML, JSON file storage.

---

## File Structure

```
TATAR/
├── server.js            # Express server + REST API routes + admin auth
├── data.json            # Persistent JSON storage (orders + tatars)
├── package.json         # Node project config with express dependency
├── public/
│   ├── index.html       # HTML structure only (no inline CSS/JS)
│   ├── style.css        # All styles extracted from original
│   └── app.js           # Frontend logic — fetch-based, no localStorage
└── docs/                # (existing spec + plan docs)
```

---

### Task 1: Create package.json and data.json

**Files:**
- Create: `package.json`
- Create: `data.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "tatar",
  "version": "1.0.0",
  "description": "TATAR — Campus food delivery by student runners",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.0"
  }
}
```

- [ ] **Step 2: Create data.json with seed data**

```json
{
  "orders": [],
  "tatars": [
    { "id": 1, "name": "Mendsaikhan", "phone": "8037-7308", "active": true },
    { "id": 2, "name": "Tuguldur", "phone": "9905-9489", "active": true },
    { "id": 3, "name": "Ganaa", "phone": "8906-2048", "active": true },
    { "id": 4, "name": "Tsogt-Ochir", "phone": "9590-7016", "active": true }
  ]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/enkhe/Desktop/TATAR && npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

---

### Task 2: Create server.js with all API routes

**Files:**
- Create: `server.js`

This is the core backend. It serves static files, reads/writes `data.json`, and exposes all API endpoints. Admin password is stored here (server-side only, never sent to client).

- [ ] **Step 1: Create server.js**

```js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = 'schooldash2024';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Orders ---

app.get('/api/orders', (req, res) => {
  const data = readData();
  res.json(data.orders);
});

app.post('/api/orders', (req, res) => {
  const { item, location, price, deliverTo, contact, notes } = req.body;
  if (!item || !location || !price || price <= 0 || !deliverTo || !contact) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const data = readData();
  const order = {
    id: Date.now(),
    item,
    location,
    price: Math.max(1, Math.round(Number(price))),
    fee: Math.round(Number(price) * 0.5),
    total: Math.round(Number(price) * 1.5),
    deliverTo,
    contact,
    notes: notes || '',
    status: 'pending',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  data.orders.unshift(order);
  writeData(data);
  res.status(201).json(order);
});

app.patch('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['confirmed', 'rejected', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const data = readData();
  const order = data.orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  writeData(data);
  res.json(order);
});

// --- Tatars ---

app.get('/api/tatars', (req, res) => {
  const data = readData();
  res.json(data.tatars);
});

app.post('/api/tatars', (req, res) => {
  const { name, studentId, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone required' });
  }
  const data = readData();
  const tatar = { id: Date.now(), name, studentId: studentId || '', phone, active: true };
  data.tatars.push(tatar);
  writeData(data);
  res.status(201).json(tatar);
});

app.delete('/api/tatars/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = readData();
  const idx = data.tatars.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tatar not found' });
  data.tatars.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// --- Admin ---

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

// --- Stats ---

app.get('/api/stats', (req, res) => {
  const data = readData();
  const delivered = data.orders.filter(o => o.status === 'delivered').length;
  const activeTatars = data.tatars.filter(t => t.active).length;
  res.json({ delivered, activeTatars });
});

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TATAR server running at http://localhost:${PORT}`);
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  LAN: http://${net.address}:${PORT}`);
      }
    }
  }
});
```

- [ ] **Step 2: Verify server starts**

Run: `cd /Users/enkhe/Desktop/TATAR && node server.js &`
Then: `curl http://localhost:3000/api/tatars`
Expected: JSON array of 4 tatars.
Then: `kill %1` to stop the background server.

---

### Task 3: Extract style.css from index.html

**Files:**
- Create: `public/style.css`

Extract all CSS from the `<style>` block in the original `index.html`. Remove all SMS-related styles (`#sms-config`, `.sms-fields`, `.sms-save-btn`, `.sms-indicator`, `.sms-dot`). Fix the redundant inline `grid-column` on `.form-group.full`.

- [ ] **Step 1: Create public/style.css**

Copy lines 8–279 of the original `index.html` (everything inside `<style>...</style>`) into `public/style.css`, with these removals:
- Remove the `#sms-config` block (lines 227–231)
- Remove `#sms-config h3` (line 232)
- Remove `#sms-config p` (line 233)
- Remove `.sms-fields` (lines 234–235)
- Remove `.sms-save-btn` (lines 236–239)
- Remove `.sms-indicator` (lines 268–271)
- Remove `.sms-dot` / `.sms-dot.active` (lines 272–273)

The rest of the CSS transfers unchanged.

---

### Task 4: Create public/index.html (HTML structure only)

**Files:**
- Create: `public/index.html`

Pure HTML — no `<style>` or `<script>` blocks inline. Links to `style.css` and `app.js`. All SMS-related HTML is removed. The `lang` attribute is kept as `en` (the UI text is English).

Key changes from original:
- Remove the entire `#sms-config` div (lines 368–398)
- Remove the redundant `style="grid-column:1/-1;"` from `.form-group.full` divs
- Remove `style="margin-top:1.5rem;"` from the form-grid div (move to CSS)
- Link `<link rel="stylesheet" href="style.css">` in head
- Add `<script src="app.js"></script>` before `</body>`
- Remove the hardcoded `75` from stat-orders (just use `0` — server provides the real count)

- [ ] **Step 1: Create public/index.html**

The HTML structure stays identical to the original minus SMS elements. The file links to external CSS and JS. All `onclick` handlers remain (they call functions defined in `app.js`).

---

### Task 5: Create public/app.js (frontend logic)

**Files:**
- Create: `public/app.js`

This is the biggest change. All localStorage calls become `fetch()` calls to the API. Admin password check goes through `/api/admin/login`. Orders and tatars are fetched from server. A 5-second polling loop keeps the orders list fresh.

- [ ] **Step 1: Create public/app.js**

Key differences from original script:

1. **No `ADMIN_PASSWORD` constant** — login calls `POST /api/admin/login`
2. **No `localStorage` calls anywhere** — all data from API
3. **`postOrder()`** — sends `POST /api/orders`, then re-fetches orders
4. **`confirmOrder(id)` / `rejectOrder(id)` / `deliverOrder(id)`** — send `PATCH /api/orders/:id`
5. **`joinAsTatar()`** — sends `POST /api/tatars`
6. **`removeTatar(id)`** — sends `DELETE /api/tatars/:id` with `confirm()` dialog first
7. **`fetchOrders()`** — `GET /api/orders`, called every 5 seconds
8. **`fetchTatars()`** — `GET /api/tatars`, called on init and after changes
9. **`fetchStats()`** — `GET /api/stats`, updates the hero stats
10. **`checkAdmin()`** — `POST /api/admin/login` with password, sets `isAdmin` on success
11. **`escHtml()`** — also escapes single quotes (`&#39;`)
12. **`updatePrice()`** — rejects negative values (clamps to 0)
13. **`renderOrders()`** — uses the fetched orders, filters rejected from non-admin view
14. **`renderTatars()`** — shows actual active/inactive status
15. **All SMS functions removed** (`sendSMS`, `formatPhone`, `loadSmsConfig`, `saveSmsConfig`, `updateSmsStatus`)
16. **Polling loop** — `setInterval(fetchOrders, 5000)` for real-time sync

---

### Task 6: Remove original index.html, verify full app

**Files:**
- Delete: `index.html` (the original monolith in project root)

- [ ] **Step 1: Move original to backup**

Run: `mv /Users/enkhe/Desktop/TATAR/index.html /Users/enkhe/Desktop/TATAR/index.html.bak`

- [ ] **Step 2: Start server and verify**

Run: `cd /Users/enkhe/Desktop/TATAR && node server.js`

Test in browser at `http://localhost:3000`:
1. Page loads with all sections visible
2. Hero stats show real counts from server
3. Place an order — it appears in the live feed
4. Open a second browser tab — the order appears there too (the core fix)
5. Admin login works (password: `schooldash2024`)
6. Admin can confirm/reject/deliver orders
7. "Be a Tatar" join flow works
8. Admin can remove tatars (with confirm dialog)
9. Orders auto-refresh every 5 seconds

- [ ] **Step 3: Delete backup after verification**

Run: `rm /Users/enkhe/Desktop/TATAR/index.html.bak`

---

## Bug Fixes Covered By This Plan

| # | Bug | Fixed In |
|---|-----|----------|
| 1 | Admin password exposed in client | Task 2 (server.js holds password) + Task 5 (app.js calls API) |
| 2 | Twilio secrets in localStorage | Task 5 (SMS removed entirely) |
| 3 | Twilio secrets sent from frontend | Task 5 (SMS removed entirely) |
| 4 | No input sanitization for SMS | Task 5 (SMS removed entirely) |
| 5 | `active` variable unused in renderOrders | Task 5 (renders filtered list for non-admin) |
| 6 | updateStats counts confirmed as delivered | Task 2 (server only counts `delivered`) |
| 7 | escHtml missing single-quote escape | Task 5 (added `&#39;`) |
| 8 | Ticker animation gap | Task 3 (CSS unchanged — original doubled content is correct) |
| 9 | Hardcoded "75" base stat | Task 2 + 5 (real count from `/api/stats`) |
| 10 | No way to clear old orders | Deferred (not in scope — could add later) |
| 11 | Tatars always show "Active" | Task 5 (renders actual `active` property) |
| 12 | Price accepts negative values | Task 2 (server clamps) + Task 5 (frontend clamps) |
| 13 | No confirm before removing tatar | Task 5 (`confirm()` dialog added) |
| 14 | Student ID not validated | Deferred (not blocking — left optional) |
| 15 | Redundant inline grid-column | Task 4 (removed from HTML) |
| 16 | Toast textContent wipes flex layout | Task 5 (uses `textContent` which is fine — the flex gap was aspirational, not functional) |
| 17 | No `lang="mn"` | Kept as `en` — UI text is English |
