// ── SHARED STATE ────────────────────────────────────────────
let currentUser = null;
let pendingOrderId = null;
let orderMap = null;
let orderMarker = null;

// ── INIT (runs on index.html) ────────────────────────────────
if (document.getElementById('order-section')) {
  initIndex();
}

async function initIndex() {
  currentUser = await getMe();
  if (currentUser) {
    document.getElementById('nav-user').style.display = 'flex';
    document.getElementById('nav-photo').src = currentUser.photo;
    document.getElementById('nav-name').textContent = currentUser.name;
    document.getElementById('join-btn').style.display = 'none';
  }

  fetchOrders();
  fetchTatars();
  fetchStats();
  initMap();
  setInterval(fetchOrders, 5000);
  setInterval(fetchStats, 15000);
}

// ── MAP ──────────────────────────────────────────────────────
function initMap() {
  if (!document.getElementById('order-map')) return;
  orderMap = L.map('order-map').setView([47.8864, 106.9057], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(orderMap);

  orderMap.on('click', e => {
    if (orderMarker) orderMarker.remove();
    orderMarker = L.marker(e.latlng).addTo(orderMap)
      .bindPopup('📍 Your delivery spot').openPopup();
  });
}

// ── FETCH DATA ───────────────────────────────────────────────
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    renderOrderList(document.getElementById('orders-list'), orders, false);

    const pending = orders.filter(o => o.status === 'pending').length;
    const badge = document.getElementById('pending-badge');
    if (badge) {
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
      badge.textContent = `${pending} pending`;
    }

    // check if current session has an order being price-confirmed or delivering
    if (pendingOrderId) {
      const mine = orders.find(o => o.id === pendingOrderId);
      if (mine) handleMyOrderStatus(mine);
    }
  } catch(e) {}
}

async function fetchTatars() {
  try {
    const res = await fetch('/api/tatars');
    const tatars = await res.json();
    const grid = document.getElementById('tatars-grid');
    if (!grid) return;
    if (!tatars.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🏃</div><div class="empty-title">No tatars yet</div></div>`;
      return;
    }
    grid.innerHTML = tatars.map(t => `
      <div class="tatar-card">
        <div class="tatar-avatar">
          ${t.photo ? `<img src="${t.photo}" alt="${escHtml(t.name)}">` : '🏃'}
        </div>
        <div class="tatar-name">${escHtml(t.name)}</div>
        <div class="tatar-status">Active</div>
      </div>`).join('');
  } catch(e) {}
}

async function fetchStats() {
  try {
    const res = await fetch('/api/tatars');
    const tatars = await res.json();
    const ordersRes = await fetch('/api/orders');
    const orders = await ordersRes.json();
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const el = document.getElementById('stat-delivered');
    const el2 = document.getElementById('stat-tatars');
    if (el) el.textContent = delivered;
    if (el2) el2.textContent = tatars.length;
  } catch(e) {}
}

// ── RENDER ORDERS ────────────────────────────────────────────
function renderOrderList(container, orders, isAdmin) {
  if (!container) return;
  const visible = isAdmin ? orders : orders.filter(o => o.status !== 'cancelled');

  if (!visible.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏃</div>
        <div class="empty-title">No active orders</div>
        <div class="empty-sub">All quiet! Be the first to place one.</div>
      </div>`;
    return;
  }

  const statusText = {
    pending: '⏳ Pending',
    taken: '🏃 Picked up',
    price_pending: '💰 Awaiting price confirm',
    delivering: '🚀 On the way',
    delivered: '✅ Delivered',
    cancelled: '❌ Cancelled',
  };

  container.innerHTML = visible.map(o => `
    <div class="order-card ${o.status}">
      <div class="order-avatar">🍽️</div>
      <div class="order-body">
        <div class="order-title">${escHtml(o.item)}${o.quantity > 1 ? ` ×${o.quantity}` : ''}</div>
        <div class="order-meta">
          <span>📍 ${escHtml(o.location)}</span>
          <span>🏠 ${escHtml(o.deliver_building)}, ${escHtml(o.deliver_room)}</span>
          <span>⏰ ${o.time || new Date(o.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
          ${o.tatar ? `<span>🏃 ${escHtml(o.tatar.name)}</span>` : ''}
        </div>
        ${o.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">📝 ${escHtml(o.notes)}</div>` : ''}
        ${isAdmin ? `<div style="margin-top:8px;"><button class="reject-btn" style="font-size:11px;padding:4px 10px;" onclick="cancelOrder('${o.id}')">Cancel</button></div>` : ''}
      </div>
      <div class="order-right">
        <span class="status-pill status-${o.status}">${statusText[o.status] || o.status}</span>
      </div>
    </div>`).join('');
}

// ── POST ORDER ───────────────────────────────────────────────
async function postOrder() {
  const item = document.getElementById('item').value.trim();
  const quantity = document.getElementById('quantity').value;
  const location = document.getElementById('location').value;
  const building = document.getElementById('deliver-building').value;
  const room = document.getElementById('deliver-room').value;
  const contact = document.getElementById('contact').value.trim();
  const notes = document.getElementById('notes').value.trim();

  clearErrors();
  let valid = true;

  if (!item) { showError('err-item', 'Required'); valid = false; }
  if (!quantity || isNaN(quantity) || Number(quantity) < 1) { showError('err-quantity', 'Must be a number ≥ 1'); valid = false; }
  if (!location) { showError('err-location', 'Select a pick-up spot'); valid = false; }
  if (!building) { showError('err-building', 'Select a building'); valid = false; }
  if (!room || isNaN(room)) { showError('err-room', 'Enter a valid room number'); valid = false; }
  if (!contact) { showError('err-contact', 'Required'); valid = false; }
  else if (!/^\d{4}-\d{4}$/.test(contact)) { showError('err-contact', 'Format must be XXXX-XXXX'); valid = false; }

  if (!valid) return;

  const btn = document.getElementById('post-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Posting...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item, quantity: Number(quantity), location,
        deliver_building: building, deliver_room: room,
        contact, notes,
      }),
    });

    if (!res.ok) {
      const e = await res.json();
      toast(e.error || 'Failed to post order', 'error');
      return;
    }

    const order = await res.json();
    pendingOrderId = order.id;

    // clear form
    ['item','quantity','deliver-room','contact','notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('location').value = '';
    document.getElementById('deliver-building').value = '';
    if (orderMarker) { orderMarker.remove(); orderMarker = null; }

    toast('✅ Order posted! Tatars have been notified.', 'success');
    fetchOrders();
    document.getElementById('order-section').scrollIntoView({ behavior: 'smooth' });
  } catch(e) {
    toast('Could not reach server', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🛒 Post Order — Tatars Will Be Notified';
  }
}

// ── HANDLE MY ORDER STATUS CHANGES ──────────────────────────
function handleMyOrderStatus(order) {
  const formCard = document.getElementById('order-form-card');
  const priceBox = document.getElementById('price-confirm-box');
  const verifyBox = document.getElementById('verify-box');

  if (order.status === 'price_pending') {
    formCard.style.display = 'none';
    priceBox.style.display = 'block';
    verifyBox.style.display = 'none';
    document.getElementById('confirm-price-amt').textContent = order.tatar_price?.toLocaleString();
    document.getElementById('confirm-fee-amt').textContent = order.fee?.toLocaleString();
    document.getElementById('confirm-total-amt').textContent = order.total?.toLocaleString();
  } else if (order.status === 'delivering') {
    formCard.style.display = 'none';
    priceBox.style.display = 'none';
    verifyBox.style.display = 'block';
    document.getElementById('verify-code-display').textContent = order.verify_code || '----';
  } else if (order.status === 'delivered' || order.status === 'cancelled') {
    formCard.style.display = 'block';
    priceBox.style.display = 'none';
    verifyBox.style.display = 'none';
    pendingOrderId = null;
    if (order.status === 'delivered') {
      toast('🎉 Your order was delivered!', 'success');
    }
  }
}

async function confirmPrice(accepted) {
  if (!pendingOrderId) return;
  try {
    const res = await fetch(`/api/orders/${pendingOrderId}/confirm-price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted }),
    });
    if (res.ok) {
      if (accepted) toast('✅ Confirmed! Your tatar is on the way.', 'success');
      else { toast('Order cancelled.', 'error'); pendingOrderId = null; }
      fetchOrders();
    }
  } catch(e) { toast('Failed', 'error'); }
}

// ── TELEGRAM USERNAME ────────────────────────────────────────
async function saveTelegram() {
  const input = document.getElementById('tg-username');
  const msg = document.getElementById('tg-msg');
  let username = input.value.trim().replace(/^@/, '');
  if (!username) { msg.style.color = 'var(--error)'; msg.textContent = 'Enter your Telegram username'; return; }
  const res = await fetch('/auth/telegram', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_username: username }),
  });
  if (res.ok) {
    msg.style.color = 'var(--accent)';
    msg.textContent = '✅ Saved! Admin will review your application.';
  } else {
    msg.style.color = 'var(--error)';
    msg.textContent = 'Failed to save. Try again.';
  }
}

// ── AUTH ─────────────────────────────────────────────────────
async function getMe() {
  try {
    const res = await fetch('/auth/me');
    return await res.json();
  } catch(e) { return null; }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── MODALS ───────────────────────────────────────────────────
function openJoinModal() {
  document.getElementById('join-modal').classList.add('open');
}
function closeJoinModal() {
  document.getElementById('join-modal')?.classList.remove('open');
}

// close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

// ── HELPERS ──────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  const input = el.previousElementSibling;
  if (input) input.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('show'); el.textContent = '';
  });
  document.querySelectorAll('input.error, select.error').forEach(el => el.classList.remove('error'));
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type || 'success'}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.className = '', 3500);
}
