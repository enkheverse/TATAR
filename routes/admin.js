const router = require('express').Router();
const supabase = require('../config/supabase');
const telegram = require('../services/telegram');

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

// GET all pending tatars
router.get('/pending', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, photo, created_at')
    .eq('role', 'tatar')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  res.json(data || []);
});

// GET all tatars
router.get('/tatars', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, photo, status, created_at')
    .eq('role', 'tatar')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// POST approve a tatar
router.post('/approve/:id', requireAdmin, async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .update({ status: 'approved' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });

  await telegram.notify(
    `🏃 <b>${user.name}</b> has been approved as a tatar!\n` +
    `Welcome to the team! Here is your group link — share it only with approved tatars.`
  );

  res.json({ success: true, user });
});

// POST reject / remove a tatar
router.post('/reject/:id', requireAdmin, async (req, res) => {
  await supabase.from('users').update({ status: 'rejected' }).eq('id', req.params.id);
  res.json({ success: true });
});

// DELETE a tatar account
router.delete('/tatars/:id', requireAdmin, async (req, res) => {
  await supabase.from('users').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// GET all orders (admin overview)
router.get('/orders', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('orders')
    .select('*, tatar:tatar_id(name), customer:customer_id(name)')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// DELETE cancel any order
router.delete('/orders/:id', requireAdmin, async (req, res) => {
  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', req.params.id);
  res.json({ success: true });
});

// GET overview stats
router.get('/stats', requireAdmin, async (req, res) => {
  const [{ count: totalOrders }, { count: delivered }, { count: pending }, { count: tatars }] =
    await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'tatar').eq('status', 'approved'),
    ]);

  res.json({ totalOrders, delivered, pending, tatars });
});

module.exports = router;
