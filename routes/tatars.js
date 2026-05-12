const router = require('express').Router();
const supabase = require('../config/supabase');
const telegram = require('../services/telegram');

// GET all approved tatars (public)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, photo, status')
    .eq('role', 'tatar')
    .eq('status', 'approved');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET tatar's active order
router.get('/my-order', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('tatar_id', req.user.id)
    .in('status', ['taken', 'price_pending', 'delivering'])
    .order('taken_at', { ascending: false })
    .limit(1)
    .single();

  res.json(data || null);
});

// GET tatar stats
router.get('/stats', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Login required' });

  const { data: delivered } = await supabase
    .from('orders')
    .select('id, total, fee')
    .eq('tatar_id', req.user.id)
    .eq('status', 'delivered');

  const { data: ratings } = await supabase
    .from('ratings')
    .select('stars')
    .eq('tatar_id', req.user.id);

  const totalEarned = (delivered || []).reduce((sum, o) => sum + (o.fee || 0), 0);
  const avgRating = ratings?.length
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null;

  res.json({
    deliveries: (delivered || []).length,
    totalEarned,
    avgRating,
  });
});

// GET tatar public profile
router.get('/:id/profile', async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, photo, created_at')
    .eq('id', req.params.id)
    .eq('role', 'tatar')
    .eq('status', 'approved')
    .single();
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { data: delivered } = await supabase
    .from('orders')
    .select('id, item, total, fee, delivered_at')
    .eq('tatar_id', req.params.id)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(5);

  const { data: ratings } = await supabase
    .from('ratings')
    .select('stars')
    .eq('tatar_id', req.params.id);

  const { count: totalDeliveries } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('tatar_id', req.params.id)
    .eq('status', 'delivered');

  const avgRating = ratings?.length
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null;

  res.json({
    ...user,
    deliveries: totalDeliveries || 0,
    avgRating,
    recentOrders: delivered || [],
  });
});

module.exports = router;
