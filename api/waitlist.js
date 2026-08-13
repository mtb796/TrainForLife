/* Waitlist / "Notify me" capture — Vercel Serverless Function.
 *
 * A static page cannot send email, so the browser POSTs here.
 *
 * TO TURN ON REAL EMAIL:
 *   1. Create a free account at resend.com and verify your sending domain
 *      (or any provider with a simple REST send endpoint).
 *   2. In Vercel: Project -> Settings -> Environment Variables, add
 *        RESEND_API_KEY   = re_xxxxxxxxxxxx
 *        WAITLIST_TO      = hello@thestrongacademy.com
 *        WAITLIST_FROM    = waitlist@thestrongacademy.com   (must be on the verified domain)
 *   3. Redeploy.
 *
 * Until RESEND_API_KEY exists this returns 501, and the site falls back to
 * opening a pre-filled email in the visitor's mail client, so "Notify me"
 * always does something real.
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  var name = String(body.name || '').trim().slice(0, 120);
  var email = String(body.email || '').trim().slice(0, 200);
  var event = String(body.event || '').trim().slice(0, 200);
  var when = String(body.date || '').trim().slice(0, 40);

  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Name and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'That email address does not look right.' });
  }

  var KEY = process.env.RESEND_API_KEY;
  if (!KEY) {
    // Not configured yet — tell the client so it can fall back to mailto.
    return res.status(501).json({ ok: false, error: 'Email delivery is not configured yet.' });
  }

  var to = process.env.WAITLIST_TO || 'hello@thestrongacademy.com';
  var from = process.env.WAITLIST_FROM || 'waitlist@thestrongacademy.com';

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  try {
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'The Strong Academy <' + from + '>',
        to: [to],
        reply_to: email,
        subject: 'Waitlist request — ' + (event || 'a class'),
        html:
          '<h2>New waitlist request</h2>' +
          '<p><strong>Name:</strong> ' + esc(name) + '<br>' +
          '<strong>Email:</strong> ' + esc(email) + '<br>' +
          '<strong>Class:</strong> ' + esc(event || '—') + '<br>' +
          '<strong>Date:</strong> ' + esc(when || '—') + '</p>'
      })
    });

    if (!r.ok) {
      var detail = await r.text();
      console.error('Resend rejected the request:', r.status, detail);
      return res.status(502).json({ ok: false, error: 'Could not send the notification.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Waitlist send failed:', err);
    return res.status(502).json({ ok: false, error: 'Could not send the notification.' });
  }
};
