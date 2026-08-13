/* Admin sign in / sign out / session probe.
 *   POST   { password }  -> sets the signed cookie
 *   DELETE               -> clears it
 *   GET                  -> { authed, configured }
 */
'use strict';

const auth = require('../_lib/auth');
const { readBody, json, methodGuard, throttle, clientIp } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['GET', 'POST', 'DELETE'])) return;

  if (req.method === 'GET') {
    return json(res, 200, { ok: true, authed: auth.isAuthed(req), configured: auth.configured() });
  }

  if (req.method === 'DELETE') {
    auth.clearSession(res);
    return json(res, 200, { ok: true });
  }

  if (!auth.configured()) {
    return json(res, 503, {
      ok: false,
      error: 'Admin access is not configured yet. Set ADMIN_PASSWORD and SESSION_SECRET in Vercel.',
    });
  }

  // brute-force brake
  if (throttle('login:' + clientIp(req), 5, 60000)) {
    return json(res, 429, { ok: false, error: 'Too many attempts. Wait a minute and try again.' });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { return json(res, 400, { ok: false, error: 'Could not read request.' }); }

  if (!auth.checkPassword(body.password || '')) {
    return json(res, 401, { ok: false, error: 'Incorrect password.' });
  }

  auth.setSession(res);
  return json(res, 200, { ok: true });
};
