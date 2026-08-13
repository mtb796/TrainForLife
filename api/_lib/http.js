/* Small request/response helpers shared by the API routes. */
'use strict';

const crypto = require('crypto');

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (e) { return {}; }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return { __raw: raw }; }
}

// Calendly signs the raw bytes, so the webhook needs them verbatim.
async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 256 * 1024) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function methodGuard(req, res, allowed) {
  if (allowed.includes(req.method)) return false;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { ok: false, error: 'Method not allowed' });
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isEmail = (s) => typeof s === 'string' && s.length <= 200 && EMAIL_RE.test(s.trim());
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/* Very small in-memory throttle. Serverless instances are short-lived so
   this only blunts bursts from a single warm instance — it is a speed bump,
   not a security control. Put a real WAF in front if abuse becomes an issue. */
const hits = new Map();
function throttle(key, max = 8, windowMs = 60000) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now - rec.start > windowMs) { hits.set(key, { start: now, n: 1 }); return false; }
  rec.n += 1;
  if (hits.size > 5000) hits.clear();
  return rec.n > max;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd || '')).split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = { readBody, readRaw, json, methodGuard, isEmail, str, throttle, clientIp, timingSafeEqual };
