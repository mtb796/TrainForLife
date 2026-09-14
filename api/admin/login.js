/* Admin sign in / sign out / session probe.
 *   POST   { username, password }  -> sets the signed cookie
 *   DELETE                         -> clears it
 *   GET                            -> { authed, configured, needsSetup }
 */
'use strict';

const auth = require('../_lib/auth');
const { readBody, json, methodGuard, throttle, clientIp } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['GET', 'POST', 'DELETE'])) return;

  if (req.method === 'GET') {
    const sess = auth.session(req);
    let needsSetup = false;
    try { needsSetup = auth.configured() ? await auth.needsSetup() : false; }
    catch (e) { console.error('needsSetup check failed', e); }
    return json(res, 200, {
      ok: true,
      authed: Boolean(sess),
      username: sess ? sess.username : null,
      mustSetPassword: sess ? sess.temporary : false,
      configured: auth.configured(),
      needsSetup,
    });
  }

  if (req.method === 'DELETE') {
    auth.clearSession(res);
    return json(res, 200, { ok: true });
  }

  if (!auth.configured()) {
    return json(res, 503, {
      ok: false,
      error: 'Admin access is not configured yet. Set SESSION_SECRET in Vercel.',
    });
  }

  // brute-force brake
  if (throttle('login:' + clientIp(req), 5, 60000)) {
    return json(res, 429, { ok: false, error: 'Too many attempts. Wait a minute and try again.' });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { return json(res, 400, { ok: false, error: 'Could not read request.' }); }

  let result;
  try { result = await auth.checkCredentials(body.username, body.password); }
  catch (e) {
    console.error('login failed', e);
    return json(res, 500, { ok: false, error: 'Could not check those credentials. Try again.' });
  }

  // One message for a wrong username and a wrong password, so the form can't
  // be used to discover which usernames exist.
  if (!result.ok) return json(res, 401, { ok: false, error: 'Incorrect username or password.' });

  auth.setSession(res, result.username, result.temporary);
  return json(res, 200, { ok: true, username: result.username, mustSetPassword: result.temporary });
};
