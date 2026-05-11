const router = require('express').Router();
const passport = require('../config/passport');
const supabase = require('../config/supabase');

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth' }),
  (req, res) => {
    if (req.user.status === 'pending') return res.redirect('/pending.html');
    if (req.user.role === 'admin') return res.redirect('/admin.html');
    res.redirect('/tatar.html');
  }
);

router.post('/logout', (req, res) => {
  req.logout(() => res.json({ success: true }));
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json(null);
  res.json({
    id: req.user.id,
    name: req.user.name,
    photo: req.user.photo,
    role: req.user.role,
    status: req.user.status,
  });
});

router.patch('/telegram', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  const { telegram_username } = req.body;
  if (!telegram_username) return res.status(400).json({ error: 'Missing username' });
  await supabase.from('users').update({ telegram_username }).eq('id', req.user.id);
  res.json({ success: true });
});

module.exports = router;
