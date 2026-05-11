# TATAR (SchoolDash) — Local Deployment Restructure

## Problem
The app stores all data in browser localStorage. Orders placed on one device are invisible to other devices. Admin actions, tatar registrations, and order status changes are all siloed per-browser.

## Solution
Replace localStorage with a local Node.js/Express server that serves the frontend and provides a REST API. All devices on the same LAN hit the same server, sharing one data store.

## Architecture

```
TATAR/
├── server.js            # Express server + all API routes
├── data.json            # Persistent storage (orders, tatars, config)
├── package.json
└── public/
    ├── index.html       # HTML structure only
    ├── style.css        # All styles
    └── app.js           # Frontend JS — fetches from API, no localStorage
```

### Server (server.js)
- Express static file server for `public/`
- REST API endpoints:
  - `GET /api/orders` — list all orders
  - `POST /api/orders` — create order
  - `PATCH /api/orders/:id` — update status (confirm/reject/deliver)
  - `GET /api/tatars` — list tatars
  - `POST /api/tatars` — register new tatar
  - `DELETE /api/tatars/:id` — remove tatar (admin)
  - `POST /api/admin/login` — validate admin password (server-side check)
  - `GET /api/stats` — order counts
- Password checked server-side (not exposed to client)
- Data persisted to `data.json` on every write

### Data Store (data.json)
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

### Frontend (public/)
- `index.html` — pure HTML structure, no inline CSS/JS
- `style.css` — all styles extracted from original file
- `app.js` — all logic, uses `fetch()` to talk to API instead of localStorage
- Auto-polls `GET /api/orders` every 5 seconds for near-real-time updates

## Bug Fixes Included
1. Admin password moved server-side (no longer in client source)
2. Unused `active` variable in renderOrders — use it to filter rejected orders
3. updateStats counts only 'delivered' orders, not 'confirmed'
4. escHtml escapes single quotes
5. Tatar active status actually reflected in UI
6. Price field rejects negative/zero values
7. Confirm dialog before removing a tatar
8. Remove hardcoded "75" base stat — use real delivered count from server
9. Remove SMS/Twilio config from frontend entirely (out of scope for local deployment)
10. Fix ticker animation gap
11. Toast uses innerHTML with proper structure
12. Fix redundant inline grid-column style

## What's Removed
- All localStorage usage
- SMS/Twilio integration (not needed for local LAN deployment)
- Cloudflare Worker references

## How to Run
```bash
cd TATAR
npm install
node server.js
# Open http://localhost:3000 on any device on the same network
# Or http://<server-ip>:3000 from other devices
```

## Constraints
- No internet required
- No database to install (JSON file)
- Few concurrent users (campus scale)
- Single server machine on local network
