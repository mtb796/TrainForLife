/* Admin identity and session handling.
 *
 * Two ways to sign in, checked in this order:
 *
 *   1. A stored account (username + scrypt hash) in the database. This is
 *      what Venus creates the first time she signs in, and from then on it
 *      is the only credential that works.
 *   2. The bootstrap credentials in the environment (ADMIN_USER /
 *      ADMIN_PASSWORD). These exist only so there is a way in before the
 *      stored account is created. The moment a stored account exists the
 *      environment pair stops being accepted, so the person who set up the
 *      deploy does not keep a permanent back door.
 *
 * Either way the password is verified server-side once and exchanged for an
 * HMAC-signed cookie, so it never travels again.
 *
 * Env vars:
 *   ADMIN_USER       bootstrap username  (e.g. venus)
 *   ADMIN_PASSWORD   bootstrap password  — temporary, replaced on first sign-in
 *   SESSION_SECRET   long random string used to sign the cookie
 *
 * Without SESSION_SECRET the admin API refuses every request rather than
 * defaulting open — an unprotected CRM would expose personal data.
 */
'use strict';

const crypto = require('crypto');
const { timingSafeEqual } = require('./http');

const COOKIE = 'tsa_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours
const MIN_PASSWORD = 10;

const BOOT_USER = (process.env.ADMIN_USER || '').trim();
const BOOT_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || '';

/* Sessions can only be signed and verified with a secret. Everything else
   about identity is decided at sign-in time. */
const configured = () => Boolean(SECRET);

/* ---------------- password hashing ---------------- */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, SCRYPT.keylen,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64url');
  const key = await scrypt(password, salt);
  return timingSafeEqual(key.toString('base64url'), parts[2]);
}

/* Reject the passwords that make a shared login pointless. */
function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (p.length > 200) return 'That password is too long.';
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return 'Include at least one letter and one number.';
  if (BOOT_PASSWORD && p === BOOT_PASSWORD) return 'Choose something other than the temporary password.';
  return null;
}

const normUser = (v) => String(v || '').trim().toLowerCase().slice(0, 80);

/* ---------------- credentials ---------------- */

/* Returns { ok, username, temporary } — temporary means they signed in with
   the environment bootstrap and still need to set their own password. */
async function checkCredentials(username, password) {
  const store = require('./store');
  const user = normUser(username);
  const pass = String(password || '');
  if (!user || !pass) return { ok: false };

  const account = await store.getAdminAccount();
  if (account && account.password_hash) {
    if (!timingSafeEqual(user, normUser(account.username))) return { ok: false };
    if (!(await verifyPassword(pass, account.password_hash))) return { ok: false };
    return { ok: true, username: account.username, temporary: false };
  }

  // No stored account yet — fall back to the one-time bootstrap pair.
  if (!BOOT_USER || !BOOT_PASSWORD) return { ok: false };
  if (!timingSafeEqual(user, normUser(BOOT_USER))) return { ok: false };
  if (!timingSafeEqual(
    crypto.createHash('sha256').update(pass).digest('hex'),
    crypto.createHash('sha256').update(BOOT_PASSWORD).digest('hex'))) return { ok: false };
  return { ok: true, username: BOOT_USER, temporary: true };
}

/* Write the stored account. From here on the env bootstrap is dead. */
async function setCredentials(username, password) {
  const store = require('./store');
  const user = normUser(username);
  if (user.length < 3) return { ok: false, error: 'Usernames need at least 3 characters.' };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  await store.saveAdminAccount({ username: user, password_hash: await hashPassword(password) });
  return { ok: true, username: user };
}

/* True while the only way in is still the environment bootstrap. */
async function needsSetup() {
  const store = require('./store');
  const account = await store.getAdminAccount();
  return !(account && account.password_hash);
}

/* ---------------- session cookie ---------------- */

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function issue(user, temporary) {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${encodeURIComponent(user)}.${temporary ? 't' : 'f'}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function read(token) {
  if (!configured() || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 4) return null;
  const [user, temp, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  if (!timingSafeEqual(sign(`${user}.${temp}.${exp}`), sig)) return null;
  return { username: decodeURIComponent(user), temporary: temp === 't' };
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, user, temporary) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${issue(user, temporary)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function session(req) {
  return read(parseCookies(req)[COOKIE]);
}
function isAuthed(req) {
  return Boolean(session(req));
}

/* Guard for every admin route. Returns true when the request was rejected. */
function requireAdmin(req, res) {
  const { json } = require('./http');
  if (!configured()) {
    json(res, 503, { ok: false, error: 'Admin access is not configured. Set SESSION_SECRET.' });
    return true;
  }
  if (!isAuthed(req)) {
    json(res, 401, { ok: false, error: 'Not signed in.' });
    return true;
  }
  return false;
}

module.exports = {
  configured, checkCredentials, setCredentials, needsSetup, passwordProblem,
  hashPassword, verifyPassword, setSession, clearSession, session, isAuthed,
  requireAdmin, COOKIE, MIN_PASSWORD, BOOT_USER,
};
