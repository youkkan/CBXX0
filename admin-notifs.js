const { db, cors, isAdmin } = require('../lib/db');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Accès interdit' });

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'id manquant' });
    await db.from('notifications').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
