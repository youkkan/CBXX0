// lib/db.js — CommonJS
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Key,X-Admin-Token');
}

function verifyToken(req) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch { return null; }
}

async function isAdmin(req) {
  // 1. Clé secrète serveur (appels internes)
  const key = req.headers['x-admin-key'];
  if (key && key === process.env.ADMIN_SECRET_KEY) return true;

  // 2. Token admin signé (après auth via code)
  const adminTok = req.headers['x-admin-token'];
  if (adminTok) {
    try {
      const p = jwt.verify(adminTok, process.env.JWT_SECRET);
      if (p?.adminAuth === true) return true;
    } catch {}
  }

  // 3. JWT utilisateur avec rôle admin
  const payload = verifyToken(req);
  if (!payload) return false;
  const { data } = await db.from('users').select('role').eq('id', payload.id).maybeSingle();
  return data?.role === 'admin';
}

function jp(v, fb = null) {
  if (v == null) return fb;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fb; }
}

module.exports = { db, cors, verifyToken, isAdmin, jp };
