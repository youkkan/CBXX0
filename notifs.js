const { db, cors, isAdmin } = require('../lib/db');

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `CbX0 St0r3 <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: [to], subject, html,
      }),
    });
    return r.ok;
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Accès interdit' });

  const { notif, targets } = req.body || {};
  if (!notif) return res.status(400).json({ error: 'Données manquantes' });

  await db.from('notifications').insert({
    id: notif.id,
    to_type: Array.isArray(notif.to) ? 'selected' : 'all',
    to_ids: Array.isArray(notif.to) ? JSON.stringify(notif.to) : null,
    subject: notif.subject, message: notif.message,
    read_by: '[]', created_date: notif.date,
  });

  const html = `<div style="font-family:sans-serif;background:#06060F;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#0E0C1E;border:1px solid rgba(124,58,237,.25);padding:32px">
      <p style="font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#A78BFA;margin:0 0 16px">CbX0 St0r3</p>
      <h2 style="font-size:18px;color:#F8F7FF;margin:0 0 14px">${notif.subject}</h2>
      <p style="font-size:13px;color:#9ca3af;line-height:1.8">${notif.message.replace(/\n/g, '<br>')}</p>
    </div></div>`;

  const emailTargets = targets || [];
  const results = await Promise.allSettled(
    emailTargets.map(t => sendEmail(t.email, `CbX0 St0r3 — ${notif.subject}`, html))
  );
  const emailsSent = results.filter(r => r.status === 'fulfilled' && r.value).length;

  return res.status(200).json({ ok: true, emailsSent, total: emailTargets.length });
};
