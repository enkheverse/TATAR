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
  const safePrice = Math.max(1, Math.round(Number(price)));
  const data = readData();
  const order = {
    id: Date.now(),
    item: String(item).slice(0, 200),
    location: String(location).slice(0, 100),
    price: safePrice,
    fee: Math.round(safePrice * 0.5),
    total: Math.round(safePrice * 1.5),
    deliverTo: String(deliverTo).slice(0, 200),
    contact: String(contact).slice(0, 100),
    notes: String(notes || '').slice(0, 500),
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
  const tatar = {
    id: Date.now(),
    name: String(name).slice(0, 100),
    studentId: String(studentId || '').slice(0, 50),
    phone: String(phone).slice(0, 50),
    active: true,
  };
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
