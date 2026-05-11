let isAdmin = false;
let orders = [];
let tatars = [];

// ── INIT ────────────────────────────────────────────────────
fetchTatars();
fetchOrders();
fetchStats();
setInterval(fetchOrders, 5000);
setInterval(fetchStats, 10000);

// ── API HELPERS ─────────────────────────────────────────────
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    orders = await res.json();
    renderOrders();
  } catch (e) {
    console.error('Failed to fetch orders:', e);
  }
}

async function fetchTatars() {
  try {
    const res = await fetch('/api/tatars');
    tatars = await res.json();
    renderTatars();
  } catch (e) {
    console.error('Failed to fetch tatars:', e);
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('stat-orders').textContent = stats.delivered;
    document.getElementById('stat-tatars').textContent = stats.activeTatars;
    document.getElementById('active-label').textContent = `🏃 ${stats.activeTatars} Tatars Active`;
  } catch (e) {
    console.error('Failed to fetch stats:', e);
  }
}

// ── PRICE CALC ──────────────────────────────────────────────
function updatePrice() {
  const p = Math.max(0, parseInt(document.getElementById('price').value) || 0);
  const fee = Math.round(p * 0.5);
  document.getElementById('disp-price').textContent = p.toLocaleString();
  document.getElementById('disp-fee').textContent = fee.toLocaleString();
  document.getElementById('disp-total').textContent = (p + fee).toLocaleString();
}

// ── POST ORDER ──────────────────────────────────────────────
async function postOrder() {
  const item = document.getElementById('item').value.trim();
  const location = document.getElementById('location').value;
  const price = parseInt(document.getElementById('price').value) || 0;
  const deliverTo = document.getElementById('deliver-to').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!item || !location || price <= 0 || !deliverTo || !contact) {
    toast('⚠️ Please fill in all required fields', 'error');
    return;
  }

  const btn = document.getElementById('post-btn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, location, price, deliverTo, contact, notes }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast(`⚠️ ${err.error || 'Failed to post order'}`, 'error');
      return;
    }

    ['item', 'price', 'deliver-to', 'contact', 'notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('location').value = '';
    updatePrice();

    toast('✅ Order posted! Waiting for a tatar to pick it up...', 'success');
    await fetchOrders();
    await fetchStats();
  } catch (e) {
    toast('⚠️ Could not reach server', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── ADMIN: CONFIRM / REJECT / DELIVER ───────────────────────
async function confirmOrder(id) {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    if (res.ok) {
      toast('✅ Order confirmed', 'success');
      await fetchOrders();
    }
  } catch (e) {
    toast('⚠️ Failed to confirm order', 'error');
  }
}

async function rejectOrder(id) {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    if (res.ok) {
      toast('❌ Order rejected', 'error');
      await fetchOrders();
    }
  } catch (e) {
    toast('⚠️ Failed to reject order', 'error');
  }
}

async function deliverOrder(id) {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });
    if (res.ok) {
      toast('📦 Order marked as delivered!', 'success');
      await fetchOrders();
      await fetchStats();
    }
  } catch (e) {
    toast('⚠️ Failed to mark as delivered', 'error');
  }
}

// ── RENDER ──────────────────────────────────────────────────
function renderOrders() {
  const list = document.getElementById('orders-list');
  const visible = isAdmin ? orders : orders.filter(o => o.status !== 'rejected');

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const badge = document.getElementById('pending-badge');
  if (pendingCount > 0 && isAdmin) {
    badge.style.display = 'inline-flex';
    badge.textContent = `${pendingCount} pending`;
  } else {
    badge.style.display = 'none';
  }

  if (visible.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🏃</div>
      <p style="font-weight:700;margin-bottom:6px;">No Active Orders</p>
      <p style="font-size:13px;">All quiet right now. Be the first to place an order!</p>
    </div>`;
    return;
  }

  list.innerHTML = visible.map(o => {
    const statusClass = `status-${o.status}`;
    const statusText = o.status === 'pending' ? '⏳ Pending'
      : o.status === 'confirmed' ? '✅ Confirmed'
      : o.status === 'delivered' ? '📦 Delivered'
      : '❌ Rejected';

    let adminActions = '';
    if (o.status === 'pending') {
      adminActions = `<div class="order-actions">
        <button class="action-btn action-confirm" onclick="confirmOrder(${o.id})">✅ Confirm</button>
        <button class="action-btn action-reject" onclick="rejectOrder(${o.id})">❌ Reject</button>
      </div>`;
    } else if (o.status === 'confirmed') {
      adminActions = `<div class="order-actions">
        <button class="action-btn action-deliver" onclick="deliverOrder(${o.id})">📦 Delivered</button>
      </div>`;
    }

    return `
    <div class="order-card ${o.status}">
      <div class="order-avatar">🍽️</div>
      <div class="order-info">
        <div class="order-title">${escHtml(o.item)}</div>
        <div class="order-meta">
          <span>📍 ${escHtml(o.location)}</span>
          <span>🏠 ${escHtml(o.deliverTo)}</span>
          <span>📞 ${escHtml(o.contact)}</span>
          <span>⏰ ${o.time}</span>
        </div>
        ${o.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">📝 ${escHtml(o.notes)}</div>` : ''}
        ${adminActions}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        <div class="order-price">₮${o.total.toLocaleString()}</div>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
    </div>`;
  }).join('');
}

function renderTatars() {
  const grid = document.getElementById('tatars-grid');
  grid.innerHTML = tatars.map(t => {
    const dotClass = t.active ? 'active-dot' : 'inactive-dot';
    const statusLabel = t.active ? 'Active' : 'Inactive';
    return `
    <div class="tatar-card" id="tatar-${t.id}">
      <div class="tatar-avatar">🏃</div>
      <div class="tatar-name">${escHtml(t.name)}</div>
      <div class="tatar-phone">📞 ${escHtml(t.phone)}</div>
      <div class="tatar-status"><span class="${dotClass}">●</span> ${statusLabel}</div>
      <button class="remove-tatar" onclick="removeTatar(${t.id}, '${escHtml(t.name)}')">✕ Remove</button>
    </div>`;
  }).join('');
}

// ── TATARS ──────────────────────────────────────────────────
async function removeTatar(id, name) {
  if (!confirm(`Remove ${name} from the team?`)) return;
  try {
    const res = await fetch(`/api/tatars/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Tatar removed', 'error');
      await fetchTatars();
      await fetchStats();
    }
  } catch (e) {
    toast('⚠️ Failed to remove tatar', 'error');
  }
}

async function joinAsTatar() {
  const name = document.getElementById('join-name').value.trim();
  const studentId = document.getElementById('join-id').value.trim();
  const phone = document.getElementById('join-phone').value.trim();

  if (!name || !phone) {
    toast('Please fill in name and phone', 'error');
    return;
  }

  try {
    const res = await fetch('/api/tatars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, studentId, phone }),
    });

    if (res.ok) {
      closeJoinModal();
      toast(`🏃 ${name} joined as a tatar!`, 'success');
      await fetchTatars();
      await fetchStats();
    } else {
      const err = await res.json();
      toast(`⚠️ ${err.error}`, 'error');
    }
  } catch (e) {
    toast('⚠️ Could not reach server', 'error');
  }
}

// ── ADMIN ────────────────────────────────────────────────────
function openAdminPanel() {
  document.getElementById('admin-panel').classList.add('open');
}

function closeAdminPanel() {
  document.getElementById('admin-panel').classList.remove('open');
  document.getElementById('admin-pw').value = '';
  document.getElementById('admin-error').style.display = 'none';
}

async function checkAdmin() {
  const pw = document.getElementById('admin-pw').value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });

    if (res.ok) {
      isAdmin = true;
      document.body.classList.add('admin-mode');
      document.getElementById('admin-badge').style.display = 'flex';
      document.getElementById('admin-toggle-btn').textContent = '🔓 Logout';
      document.getElementById('admin-toggle-btn').onclick = logoutAdmin;
      closeAdminPanel();
      renderOrders();
      toast('⚡ Admin mode enabled', 'success');
    } else {
      document.getElementById('admin-error').style.display = 'block';
    }
  } catch (e) {
    toast('⚠️ Could not reach server', 'error');
  }
}

function logoutAdmin() {
  isAdmin = false;
  document.body.classList.remove('admin-mode');
  document.getElementById('admin-badge').style.display = 'none';
  document.getElementById('admin-toggle-btn').textContent = '🔑 Admin';
  document.getElementById('admin-toggle-btn').onclick = openAdminPanel;
  renderOrders();
  toast('Logged out of admin', 'success');
}

// ── HELPERS ──────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type || 'success'}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.className = '', 3500);
}

function openJoinModal() {
  document.getElementById('join-modal').classList.add('open');
}

function closeJoinModal() {
  document.getElementById('join-modal').classList.remove('open');
  ['join-name', 'join-id', 'join-phone'].forEach(id => document.getElementById(id).value = '');
}

// Close modals on backdrop click
document.getElementById('admin-panel').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAdminPanel();
});
document.getElementById('join-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeJoinModal();
});
