// ── SHARED STATE ────────────────────────────────────────────
let currentUser = null;
let pendingOrderId = null;
let orderMap = null;
let orderMarker = null;
let orderItems = [];

// ── INIT ─────────────────────────────────────────────────────
if (document.getElementById('orders-list')) {
  initIndex();
}

async function initIndex() {
  currentUser = await getMe();

  if (currentUser) {
    document.getElementById('nav-user').style.display = 'flex';
    document.getElementById('nav-photo').src = currentUser.photo;
    document.getElementById('nav-name').textContent = currentUser.name;
    document.getElementById('join-btn').style.display = 'none';
    const heroJoin = document.getElementById('hero-join-btn');
    if (heroJoin) heroJoin.style.display = 'none';
  }

  // restore pending order from localStorage
  const saved = localStorage.getItem('tatar_pending_order');
  if (saved) pendingOrderId = saved;

  fetchOrders();
  fetchTatars();
  fetchStats();
  setInterval(fetchOrders, 5000);
  setInterval(fetchStats, 15000);
}

// ── ORDER MODAL ──────────────────────────────────────────────
function openOrderModal() {
  orderItems = [];
  renderItems();
  addItem();
  goToStep(1);
  document.getElementById('contact').value = '';
  document.getElementById('notes').value = '';
  clearErrors();
  document.getElementById('order-modal').classList.add('open');
  // init map after modal opens so it renders correctly
  setTimeout(() => {
    if (!orderMap) {
      orderMap = L.map('order-map').setView([47.8864, 106.9057], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(orderMap);
      orderMap.on('click', e => {
        if (orderMarker) orderMarker.remove();
        orderMarker = L.marker(e.latlng).addTo(orderMap)
          .bindPopup('📍 Your delivery spot').openPopup();
        document.getElementById('map-hint').textContent = `📍 Pinned at ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
      });
    }
    orderMap.invalidateSize();
  }, 100);
}

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('open');
}

function goToStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`order-step-${i}`).style.display = i === n ? 'block' : 'none';
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.classList.toggle('active', i <= n);
  });

  if (n === 2) {
    // validate items before proceeding
    const valid = orderItems.every(it => it.name.trim());
    if (!orderItems.length || !valid) {
      goToStep(1);
      toast('Add at least one item', 'error');
      return;
    }
  }

  if (n === 3) {
    // validate contact
    const contact = document.getElementById('contact').value.trim();
    if (!/^\d{8}$/.test(contact)) {
      showError('err-contact', 'Enter exactly 8 digits');
      goToStep(2);
      return;
    }
    clearErrors();
    setTimeout(() => orderMap && orderMap.invalidateSize(), 100);
  }
}

// ── ITEMS ────────────────────────────────────────────────────
function addItem() {
  orderItems.push({ name: '', qty: 1 });
  renderItems();
}

function removeItem(idx) {
  orderItems.splice(idx, 1);
  renderItems();
}

function renderItems() {
  const list = document.getElementById('items-list');
  if (!list) return;
  list.innerHTML = orderItems.map((item, i) => `
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
      <input type="text" placeholder="Item name (e.g. Burger)" value="${escHtml(item.name)}"
        oninput="orderItems[${i}].name=this.value"
        style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:14px;">
      <input type="number" min="1" max="20" value="${item.qty}"
        oninput="orderItems[${i}].qty=Math.max(1,Number(this.value)||1)"
        style="width:64px;padding:10px 8px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:14px;text-align:center;">
      ${orderItems.length > 1 ? `<button onclick="removeItem(${i})" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:4px;">✕</button>` : ''}
    </div>`).join('');
}

// ── POST ORDER ───────────────────────────────────────────────
async function postOrder() {
  const contact = document.getElementById('contact').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!/^\d{8}$/.test(contact)) {
    toast('Phone must be 8 digits', 'error');
    goToStep(2);
    return;
  }

  const validItems = orderItems.filter(i => i.name.trim());
  if (!validItems.length) {
    toast('Add at least one item', 'error');
    goToStep(1);
    return;
  }

  const lat = orderMarker ? orderMarker.getLatLng().lat : null;
  const lng = orderMarker ? orderMarker.getLatLng().lng : null;

  const btn = document.getElementById('post-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Posting...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: validItems, contact, notes, lat, lng }),
    });

    if (!res.ok) {
      const e = await res.json();
      toast(e.error || 'Failed to post order', 'error');
      return;
    }

    const order = await res.json();
    pendingOrderId = order.id;
    localStorage.setItem('tatar_pending_order', order.id);

    closeOrderModal();
    if (orderMarker) { orderMarker.remove(); orderMarker = null; }
    document.getElementById('map-hint').textContent = 'No pin yet — tap anywhere on the map';

    toast('✅ Order posted! Tatars have been notified.', 'success');
    fetchOrders();
    document.getElementById('order-section').scrollIntoView({ behavior: 'smooth' });
  } catch(e) {
    toast('Could not reach server', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🛒 Post Order';
  }
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
      <div class="tatar-card" onclick="openProfile('${t.id}')" style="cursor:pointer;">
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
    const [tatarsRes, ordersRes] = await Promise.all([fetch('/api/tatars'), fetch('/api/orders')]);
    const tatars = await tatarsRes.json();
    const orders = await ordersRes.json();
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const el = document.getElementById('stat-delivered');
    const el2 = document.getElementById('stat-tatars');
    if (el) el.textContent = delivered;
    if (el2) el2.textContent = tatars.length;
  } catch(e) {}
}

// ── TATAR PROFILE ────────────────────────────────────────────
async function openProfile(id) {
  document.getElementById('profile-modal').classList.add('open');
  document.getElementById('profile-name').textContent = '...';
  document.getElementById('profile-deliveries').textContent = '...';
  document.getElementById('profile-avg').textContent = '...';
  document.getElementById('profile-orders-list').innerHTML = '';

  try {
    const res = await fetch(`/api/tatars/${id}/profile`);
    const data = await res.json();

    const photoWrap = document.getElementById('profile-photo-wrap');
    if (data.photo) {
      photoWrap.innerHTML = `<img src="${data.photo}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      photoWrap.innerHTML = '🏃';
    }

    document.getElementById('profile-name').textContent = data.name;
    document.getElementById('profile-rating').textContent = data.avgRating ? `⭐ ${data.avgRating} rating` : 'No ratings yet';
    document.getElementById('profile-deliveries').textContent = data.deliveries;
    document.getElementById('profile-avg').textContent = data.avgRating || '—';

    const list = document.getElementById('profile-orders-list');
    if (!data.recentOrders.length) {
      list.innerHTML = `<div style="font-size:13px;color:var(--muted);">No deliveries yet</div>`;
    } else {
      list.innerHTML = data.recentOrders.map(o => {
        let itemText = o.item;
        try { itemText = JSON.parse(o.item).map(i => `${i.name}${i.qty>1?` x${i.qty}`:''}`).join(', '); } catch {}
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${escHtml(itemText)}</span>
          <span style="color:var(--accent);">+₮${(o.fee||0).toLocaleString()}</span>
        </div>`;
      }).join('');
    }
  } catch(e) {
    document.getElementById('profile-name').textContent = 'Could not load';
  }
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('open');
}

// ── HANDLE MY ORDER STATUS ───────────────────────────────────
function handleMyOrderStatus(order) {
  const priceWrap = document.getElementById('price-confirm-wrap');
  const verifyWrap = document.getElementById('verify-wrap');

  if (order.status === 'price_pending') {
    priceWrap.style.display = 'block';
    verifyWrap.style.display = 'none';
    document.getElementById('confirm-price-amt').textContent = order.tatar_price?.toLocaleString();
    document.getElementById('confirm-fee-amt').textContent = order.fee?.toLocaleString();
    document.getElementById('confirm-total-amt').textContent = order.total?.toLocaleString();
  } else if (order.status === 'delivering') {
    priceWrap.style.display = 'none';
    verifyWrap.style.display = 'block';
    document.getElementById('verify-code-display').textContent = order.verify_code || '----';
  } else if (order.status === 'delivered' || order.status === 'cancelled') {
    priceWrap.style.display = 'none';
    verifyWrap.style.display = 'none';
    pendingOrderId = null;
    localStorage.removeItem('tatar_pending_order');
    if (order.status === 'delivered') toast('🎉 Your order was delivered!', 'success');
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
      else {
        toast('Order cancelled.', 'error');
        pendingOrderId = null;
        localStorage.removeItem('tatar_pending_order');
      }
      fetchOrders();
    }
  } catch(e) { toast('Failed', 'error'); }
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

  container.innerHTML = visible.map(o => {
    let itemText = o.item;
    try { itemText = JSON.parse(o.item).map(i => `${i.name}${i.qty>1?` ×${i.qty}`:''}`).join(', '); } catch {}
    return `
    <div class="order-card ${o.status}">
      <div class="order-avatar">🍽️</div>
      <div class="order-body">
        <div class="order-title">${escHtml(itemText)}</div>
        <div class="order-meta">
          <span>⏰ ${o.time || new Date(o.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
          ${o.tatar ? `<span>🏃 ${escHtml(o.tatar.name)}</span>` : ''}
          ${o.lat && o.lng ? `<span><a href="https://maps.google.com/?q=${o.lat},${o.lng}" target="_blank" style="color:var(--accent);">📍 View location</a></span>` : ''}
        </div>
        ${o.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">📝 ${escHtml(o.notes)}</div>` : ''}
        ${isAdmin ? `<div style="margin-top:8px;"><button class="reject-btn" style="font-size:11px;padding:4px 10px;" onclick="cancelOrder('${o.id}')">Cancel</button></div>` : ''}
      </div>
      <div class="order-right">
        <span class="status-pill status-${o.status}">${statusText[o.status] || o.status}</span>
      </div>
    </div>`;
  }).join('');
}

// ── PHONE (TATAR PENDING PAGE) ───────────────────────────────
async function savePhone() {
  const input = document.getElementById('tg-phone');
  const msg = document.getElementById('tg-msg');
  const phone = input.value.trim().replace(/\D/g, '').slice(-8);
  if (phone.length !== 8) { msg.style.color = 'var(--error)'; msg.textContent = 'Enter exactly 8 digits'; return; }
  const res = await fetch('/auth/phone', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (res.ok) {
    msg.style.color = 'var(--accent)';
    msg.textContent = '✅ Saved! Now message @Tatarselch_bot on Telegram and tap Share Contact.';
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

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) el.classList.remove('open');
  });
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
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('show'); el.textContent = '';
  });
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type || 'success'}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.className = '', 3500);
}
