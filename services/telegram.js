const fetch = require('node-fetch');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e) {
    console.error('Telegram error:', e.message);
    return null;
  }
}

async function postNewOrder(order) {
  const text =
    `🆕 <b>NEW ORDER #${order.id.toString().slice(-4)}</b>\n` +
    `🍽 ${order.item}${order.quantity > 1 ? ` x${order.quantity}` : ''}\n` +
    `📍 Pick up: ${order.location}\n` +
    `🏠 Deliver: ${order.deliver_building}, Room ${order.deliver_room}\n` +
    `📞 Customer: ${order.contact}\n` +
    (order.notes ? `📝 Notes: ${order.notes}\n` : '') +
    `\n💰 <i>Enter price after you see it at the store</i>`;

  const result = await call('sendMessage', {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Take this order', callback_data: `take_${order.id}` }
      ]]
    }
  });

  return result?.result?.message_id || null;
}

async function updateOrderTaken(messageId, takerName, orderId) {
  await call('editMessageText', {
    chat_id: CHAT_ID,
    message_id: messageId,
    text:
      `✅ <b>ORDER #${orderId.toString().slice(-4)} TAKEN</b>\n` +
      `🏃 Picked up by <b>${takerName}</b>\n` +
      `<i>Waiting for price confirmation...</i>`,
    parse_mode: 'HTML',
  });
}

async function updateOrderExpired(messageId, orderId) {
  await call('editMessageText', {
    chat_id: CHAT_ID,
    message_id: messageId,
    text: `❌ <b>ORDER #${orderId.toString().slice(-4)} EXPIRED</b>\n<i>No one took it in 15 minutes.</i>`,
    parse_mode: 'HTML',
  });
}

async function updateOrderDelivered(messageId, orderId, takerName) {
  await call('editMessageText', {
    chat_id: CHAT_ID,
    message_id: messageId,
    text: `📦 <b>ORDER #${orderId.toString().slice(-4)} DELIVERED</b>\n🏃 By <b>${takerName}</b>`,
    parse_mode: 'HTML',
  });
}

async function notify(text) {
  await call('sendMessage', { chat_id: CHAT_ID, text, parse_mode: 'HTML' });
}

async function answerCallback(callbackQueryId, text) {
  await call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

async function setWebhook(url) {
  return await call('setWebhook', { url: `${url}/telegram/webhook` });
}

module.exports = {
  postNewOrder,
  updateOrderTaken,
  updateOrderExpired,
  updateOrderDelivered,
  notify,
  answerCallback,
  setWebhook,
};
