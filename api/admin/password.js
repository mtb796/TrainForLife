/* Change the admin username and password.
 *   POST { current, next, username? }
 *
 * Requires a signed-in session. Writing a stored account here is also what
 * retires the ADMIN_USER / ADMIN_PASSWORD bootstrap pair, so this is the
 * route Venus uses to take sole ownership of the login.
 */
'use strict';

const auth = require('../_lib/auth');
const { readBody, json, methodGuard, throttle, clientIp } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['POST'])) return;
  if (auth.requireAdmin(req, res)) return;

  if (throttle('pw:' + clientIp(req), 5, 60000)) {
    return json(res, 429, { ok: false, error: 'Too many attempts. Wait a minute and try again.' });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { return json(res, 400, { ok: false, error: 'Could not read request.' }); }

  const sess = auth.session(req);
  const username = String(body.username || sess.username || '').trim();

  try {
    // Re-check the current password even though they are already signed in:
    // a borrowed open laptop should not be enough to lock the owner out.
    const current = await auth.checkCredentials(sess.username, body.current);
    if (!current.ok) return json(res, 401, { ok: false, error: 'Current password is incorrect.' });

    const saved = await auth.setCredentials(username, body.next);
    if (!saved.ok) return json(res, 400, { ok: false, error: saved.error });

    // Fresh cookie: new username, and no longer flagged as temporary.
    auth.setSession(res, saved.username, false);
    return json(res, 200, { ok: true, username: saved.username });
  } catch (e) {
    console.error('password change failed', e);
    return json(res, 500, { ok: false, error: 'Could not save the new password.' });
  }
};
