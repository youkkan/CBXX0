const { db, cors } = require('../lib/db');
const bcrypt = require('bcryptjs');

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `CbX0 St0r3 <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`, to: [to], subject, html }),
    });
    return r.ok;
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { currentCode, newCode } = req.body || {};
  if (!currentCode || !newCode) return res.status(400).json({ error: 'Champs manquants' });
  if (newCode.length < 8) return res.status(400).json({ error: 'Nouveau code trop court (min 8)' });

  try {
    const { data: hashRow } = await db.from('settings').select('value')
      .eq('key', 'admin_code_hash').maybeSingle();

    let valid = false;
    if (hashRow?.value) {
      valid = await bcrypt.compare(currentCode, hashRow.value);
    } else {
      valid = currentCode.toUpperCase() === (process.env.ADMIN_DEFAULT_CODE || 'CIME2024');
    }
    if (!valid) return res.status(401).json({ error: 'Code actuel incorrect' });

    const newHash = await bcrypt.hash(newCode, 12);
    await db.from('settings').upsert({ key: 'admin_code_hash', value: newHash }, { onConflict: 'key' });

    const { data: emailRow } = await db.from('settings').select('value').eq('key', 'admin_email').maybeSingle();
    if (emailRow?.value) {
      await sendEmail(emailRow.value, '⚠ Code admin modifié — CbX0 St0r3',
        `<p>Le code d'accès admin a été modifié avec succès le ${new Date().toLocaleString('fr-FR')}.</p>`);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
