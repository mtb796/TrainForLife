/* Admin session handling.
 *
 * One shared password, verified server-side, exchanged for an HMAC-signed
 * cookie. No user table needed for a single-operator business, and the
 * password itself never travels again after login.
 *
 * Env vars:
 *   ADMIN_PASSWORD   the password Venus types at /admin/crm
 *   SESSION_SECRET   long random string used to sign the cookie
 *
 * If either is missing the admin API refuses every request rather than
 * defaulting open — an unprotected CRM would expose personal data.
 */
'use strict';

const crypto = require('crypto');
const { timingSafeEqual } = require('./http');

const COOKIE = 'tsa_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || '';

const configured = () => Boolean(PASSWORD && SECRET);

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function issue() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function valid(token) {
  if (!configured() || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [who, exp, sig] = parts;
  if (who !== 'admin') return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return timingSafeEqual(sign(`${who}.${exp}`), sig);
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function checkPassword(candidate) {
  if (!configured()) return false;
  // pad to equal length so the comparison stays constant-time
  const a = crypto.createHash('sha256').update(String(candidate)).digest('hex');
  const b = crypto.createHash('sha256').update(PASSWORD).digest('hex');
  return timingSafeEqual(a, b);
}

function setSession(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${issue()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function isAuthed(req) {
  return valid(parseCookies(req)[COOKIE]);
}

/* Guard for every admin route. Returns true when the request was rejected. */
function requireAdmin(req, res) {
  const { json } = require('./http');
  if (!configured()) {
    json(res, 503, { ok: false, error: 'Admin access is not configured. Set ADMIN_PASSWORD and SESSION_SECRET.' });
    return true;
  }
  if (!isAuthed(req)) {
    json(res, 401, { ok: false, error: 'Not signed in.' });
    return true;
  }
  return false;
}

module.exports = { configured, checkPassword, setSession, clearSession, isAuthed, requireAdmin, COOKIE };
