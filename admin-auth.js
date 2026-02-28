const { db, cors } = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ ok: false });

  try {
    const { data } = await db.from('settings').select('value')
      .eq('key', 'admin_code_hash').maybeSingle();

    let ok = false;
    if (data?.value) {
      ok = await bcrypt.compare(code, data.value);
    } else {
      ok = code.toUpperCase() === (process.env.ADMIN_DEFAULT_CODE || 'CIME2024');
    }

    if (!ok) return res.status(200).json({ ok: false });

    // ✅ Émettre un token admin signé (4h) — permet d'appeler les routes admin
    const token = jwt.sign(
      { adminAuth: true, iat: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
