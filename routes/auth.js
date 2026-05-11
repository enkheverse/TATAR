const router = require('express').Router();
const passport = require('../config/passport');

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

module.exports = router;
