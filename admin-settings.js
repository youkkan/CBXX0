const { db, cors, isAdmin } = require('../lib/db');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Accès interdit' });

  if (req.method === 'GET') {
    const { data: rows } = await db.from('settings').select('key,value')
      .in('key', ['admin_email', 'cc']);
    const settings = {};
    (rows || []).forEach(r => { settings[r.key] = r.value; });
    return res.status(200).json(settings);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    // Support { adminEmail } format from frontend
    const key = body.key || (body.adminEmail ? 'admin_email' : null);
    const value = body.value !== undefined ? body.value : body.adminEmail;
    if (!key) return res.status(400).json({ error: 'key manquant' });

    try {
      await db.from('settings').upsert({ key, value }, { onConflict: 'key' });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
};
