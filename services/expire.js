const cron = require('node-cron');
const supabase = require('../config/supabase');
const telegram = require('./telegram');

function startExpireJob() {
  // runs every minute
  cron.schedule('* * * * *', async () => {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: expired } = await supabase
      .from('orders')
      .select('id, telegram_message_id')
      .eq('status', 'pending')
      .lt('created_at', cutoff);

    if (!expired || expired.length === 0) return;

    for (const order of expired) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);

      if (order.telegram_message_id) {
        await telegram.updateOrderExpired(order.telegram_message_id, order.id);
      }
    }
  });
}

module.exports = { startExpireJob };
