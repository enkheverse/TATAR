require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const supabase = require('./config/supabase');
const telegram = require('./services/telegram');
const { startExpireJob } = require('./services/expire');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'tatar-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Routes ──────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/tatars', require('./routes/tatars'));
app.use('/api/admin', require('./routes/admin'));

// ── Telegram webhook ─────────────────────────────────────────
app.post('/telegram/webhook', async (req, res) => {
  res.sendStatus(200);
  const { callback_query, message } = req.body;

  // ── Handle contact sharing (phone number linking) ──
  if (message?.contact) {
    const telegramId = message.from.id;
    // normalize: strip all non-digit chars except leading +
    // strip everything except digits, then take last 8 digits (local number)
    const digits = message.contact.phone_number.replace(/\D/g, '');
    const local8 = digits.slice(-8);

    const { data: matched } = await supabase
      .from('users')
      .update({ telegram_id: telegramId })
      .eq('phone', local8)
      .eq('role', 'tatar')
      .select()
      .single();

    if (matched) {
      await telegram.sendText(telegramId, `✅ Linked! Your Telegram is now connected to your TATAR account (${matched.name}). Wait for admin approval.`);
    } else {
      await telegram.sendText(telegramId, `❌ No account found with that phone number. Make sure you entered the same number on the TATAR website.`);
    }
    return;
  }

  // ── Handle any message → send contact request ──
  if (message && !message.contact) {
    await telegram.sendContactRequest(message.from.id);
    return;
  }

  // ── Handle inline button (take order) ──
  if (!callback_query) return;
  const { id: callbackId, data, from } = callback_query;
  if (!data?.startsWith('take_')) return;

  const orderId = data.replace('take_', '');

  const { data: tatar } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'tatar')
    .eq('status', 'approved')
    .eq('telegram_id', from.id)
    .single();

  if (!tatar) {
    await telegram.answerCallback(callbackId, '❌ Your Telegram is not linked to an approved tatar account. Message the bot to link it.');
    return;
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update({ tatar_id: tatar.id, status: 'taken', taken_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !order) {
    await telegram.answerCallback(callbackId, '⚡ Too slow! Someone else took this order.');
    return;
  }

  await telegram.answerCallback(callbackId, '✅ Order is yours! Head to the store.');
  await telegram.updateOrderTaken(order.telegram_message_id, tatar.name, order.id);
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`TATAR v2 running at http://localhost:${PORT}`);

  startExpireJob();

  // register telegram webhook on Render/Koyeb
  if (process.env.APP_URL) {
    const result = await telegram.setWebhook(process.env.APP_URL);
    console.log('Telegram webhook:', result?.ok ? '✅ set' : '❌ failed');
  }

  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  LAN: http://${net.address}:${PORT}`);
      }
    }
  }
});
