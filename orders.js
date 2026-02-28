const { db, cors, verifyToken } = require('../lib/db');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  const { order, items } = req.body || {};
  if (!order) return res.status(400).json({ error: 'Données manquantes' });

  try {
    const { error: oErr } = await db.from('orders').insert({
      id: order.id, user_email: user.email, user_id: user.id,
      items: JSON.stringify(order.items), total: order.total,
      promo: order.promo || null, method: order.method || 'livraison', date: order.date,
    });
    if (oErr) throw oErr;

    if (order.promo) {
      await db.rpc('increment_promo_uses', { promo_code: order.promo });
    }

    if (items?.length) {
      for (const item of items) {
        await db.rpc('decrement_stock', { product_id: item.id, quantity: item.qty });
      }
    }

    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
