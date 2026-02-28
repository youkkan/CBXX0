const { db, cors } = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const { data: user } = await db.from('users').select('*')
      .eq('email', email.toLowerCase().trim()).maybeSingle();

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET, { expiresIn: '30d' }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role || 'user',
        createdAt: new Date(user.created_at).toLocaleDateString('fr-FR') },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
