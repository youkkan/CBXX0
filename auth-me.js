const { db, cors, verifyToken } = require('../lib/db');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Token invalide' });

  try {
    const { data: user } = await db.from('users')
      .select('id,name,email,role,created_at').eq('id', payload.id).maybeSingle();
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

    return res.status(200).json({
      id: user.id, name: user.name, email: user.email, role: user.role || 'user',
      createdAt: new Date(user.created_at).toLocaleDateString('fr-FR'),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
