const router = require('express').Router();
const supabase = require('../config/supabase');
const telegram = require('../services/telegram');
const { generateCode, checkCode } = require('../services/verify');

// GET all orders (public — customers see their own, tatars/admin see all)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, tatar:tatar_id(name), customer:customer_id(name)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST place new order (any visitor)
router.post('/', async (req, res) => {
  const { items, contact, notes, lat, lng } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Add at least one item' });
  }
  if (!contact || !/^\d{8}$/.test(contact)) {
    return res.status(400).json({ error: 'Phone must be exactly 8 digits' });
  }

  const itemText = JSON.stringify(items.map(i => ({ name: String(i.name).slice(0, 100), qty: Math.max(1, Number(i.qty) || 1) })));
  const customer_id = req.user?.id || null;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id,
      item: itemText,
      quantity: items.length,
      location: lat && lng ? `${lat},${lng}` : '',
      deliver_building: '',
      deliver_room: '',
      contact: String(contact),
      notes: String(notes || '').slice(0, 300),
      lat: lat || null,
      lng: lng || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // post to Telegram
  const msgId = await telegram.postNewOrder(order);
  if (msgId) {
    await supabase.from('orders').update({ telegram_message_id: msgId }).eq('id', order.id);
    order.telegram_message_id = msgId;
  }

  res.status(201).json(order);
});

// PATCH tatar sets real price after seeing it at the store
router.patch('/:id/price', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  const { price } = req.body;
  if (!price || isNaN(price) || Number(price) < 1) {
    return res.status(400).json({ error: 'Price must be a positive number' });
  }

  const safePrice = Math.round(Number(price));
  const fee = Math.round(safePrice * 0.5);

  const { data: order, error } = await supabase
    .from('orders')
    .update({ tatar_price: safePrice, fee, total: safePrice + fee, status: 'price_pending' })
    .eq('id', req.params.id)
    .eq('tatar_id', req.user.id)
    .select()
    .single();

  if (error || !order) return res.status(404).json({ error: 'Order not found or not yours' });
  res.json(order);
});

// PATCH customer confirms or rejects price
router.patch('/:id/confirm-price', async (req, res) => {
  const { accepted } = req.body;

  if (accepted) {
    const code = generateCode();
    const { data: order, error } = await supabase
      .from('orders')
      .update({ status: 'delivering', verify_code: code })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } else {
    const { data: order } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select()
      .single();
    await telegram.notify(`❌ Customer rejected the price on order #${req.params.id.slice(-4)}`);
    res.json(order);
  }
});

// PATCH tatar submits verify code to complete delivery
router.patch('/:id/deliver', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  const { code } = req.body;

  const { data: order } = await supabase
    .from('orders')
    .select('*, tatar:tatar_id(name)')
    .eq('id', req.params.id)
    .single();

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!checkCode(code, order.verify_code)) {
    return res.status(400).json({ error: 'Wrong code — ask the customer to check again' });
  }

  const { data: delivered } = await supabase
    .from('orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', order.id)
    .select()
    .single();

  if (order.telegram_message_id) {
    await telegram.updateOrderDelivered(order.telegram_message_id, order.id, order.tatar?.name || 'Tatar');
  }

  res.json(delivered);
});

// POST customer rates the delivery
router.post('/:id/rate', async (req, res) => {
  const { stars } = req.body;
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be 1-5' });
  }

  const { data: order } = await supabase
    .from('orders')
    .select('tatar_id, customer_id')
    .eq('id', req.params.id)
    .single();

  if (!order) return res.status(404).json({ error: 'Order not found' });

  await supabase.from('ratings').insert({
    order_id: req.params.id,
    customer_id: order.customer_id,
    tatar_id: order.tatar_id,
    stars: Number(stars),
  });

  res.json({ success: true });
});

module.exports = router;
