const { db, cors, isAdmin, jp } = require('../lib/db');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Accès interdit' });

  const { categories, products, promos, cc, notifs } = req.body || {};

  try {
    const ops = [];

    if (products?.length) {
      ops.push(db.from('products').upsert(
        products.map(p => ({
          id: p.id, emoji: p.emoji, name: p.name, cat_id: p.catId,
          taux: p.taux, thc: p.thc || '< 0,3%', origine: p.origine || '',
          mode: p.mode || '', desc: p.desc, stock: p.stock || 0, badge: p.badge || '',
          tiers: JSON.stringify(p.tiers || []),
          images: JSON.stringify((p.images || []).filter(i => !i?.startsWith('data:'))),
          lab_pdf_url: (!p.labPdf || p.labPdf.startsWith('data:')) ? null : p.labPdf,
        })), { onConflict: 'id' }
      ));
    }

    if (categories?.length) {
      ops.push(db.from('categories').upsert(
        categories.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color })),
        { onConflict: 'id' }
      ));
    }

    if (promos?.length) {
      ops.push(db.from('promos').upsert(
        promos.map(p => ({ code: p.code, discount: p.discount, uses: p.uses || 0, max_uses: p.maxUses || 0, active: p.active })),
        { onConflict: 'code' }
      ));
    }

    if (cc) {
      ops.push(db.from('settings').upsert({ key: 'cc', value: cc }, { onConflict: 'key' }));
    }

    const results = await Promise.all(ops);
    const errors = results.filter(r => r.error).map(r => r.error.message);
    if (errors.length) return res.status(500).json({ error: errors.join(', ') });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
