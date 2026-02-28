const { db, cors } = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });

  try {
    const { data: existing } = await db.from('users').select('id')
      .eq('email', email.toLowerCase().trim()).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await db.from('users')
      .insert({ name: name.trim(), email: email.toLowerCase().trim(), password_hash: hash, role: 'user' })
      .select().single();
    if (error) throw error;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      process.env.JWT_SECRET, { expiresIn: '30d' }
    );

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: 'user',
        createdAt: new Date(user.created_at).toLocaleDateString('fr-FR') },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
