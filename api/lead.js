/* Public inquiry capture — every form on the site posts here.
 *
 * Sources: waitlist | newsletter | corporate | contact | booking
 * Stores the lead, then best-effort emails Venus. Storage failing is a
 * hard error (we must not tell someone we saved them when we didn't);
 * the email failing is not, because the record is already safe.
 */
'use strict';

const store = require('./_lib/store');
const { readBody, json, methodGuard, isEmail, str, throttle, clientIp } = require('./_lib/http');

const SOURCES = ['waitlist', 'newsletter', 'corporate', 'contact', 'booking'];

async function notify(lead) {
  const KEY = process.env.RESEND_API_KEY;
  if (!KEY) return { sent: false, reason: 'RESEND_API_KEY not set' };

  const to = process.env.WAITLIST_TO || 'hello@thestrongacademy.com';
  const from = process.env.WAITLIST_FROM || 'notifications@thestrongacademy.com';
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const rows = [
    ['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone],
    ['Source', lead.source], ['Interest', lead.interest],
    ['Class', lead.event_title], ['Date', lead.event_date], ['Message', lead.message],
  ].filter(([, v]) => v);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `The Strong Academy <${from}>`,
        to: [to],
        reply_to: lead.email || undefined,
        subject: `New ${lead.source} inquiry — ${lead.name || lead.email}`,
        html: `<h2>New ${esc(lead.source)} inquiry</h2><table cellpadding="6">` +
          rows.map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join('') +
          `</table>`,
      }),
    });
    return { sent: res.ok };
  } catch (e) {
    return { sent: false, reason: String(e.message || e) };
  }
}

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['POST'])) return;

  if (throttle('lead:' + clientIp(req), 10, 60000)) {
    return json(res, 429, { ok: false, error: 'Too many requests — please try again shortly.' });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { return json(res, e.status || 400, { ok: false, error: 'Could not read request.' }); }

  // honeypot: real people leave this empty
  if (str(body.company_website, 200)) return json(res, 200, { ok: true });

  const source = SOURCES.includes(body.source) ? body.source : 'contact';
  const email = str(body.email, 200);
  const name = str(body.name, 120);

  if (!isEmail(email)) return json(res, 400, { ok: false, error: 'Enter a valid email address.' });
  if (source !== 'newsletter' && !name) {
    return json(res, 400, { ok: false, error: 'Please include your name.' });
  }

  const lead = {
    name, email, source,
    phone: str(body.phone, 40),
    interest: str(body.interest, 120),
    message: str(body.message, 2000),
    event_title: str(body.event, 200) || str(body.event_title, 200),
    event_date: str(body.date, 40) || str(body.event_date, 40),
  };

  let saved;
  try {
    saved = await store.addLead(lead);
  } catch (e) {
    console.error('lead: storage failed', e);
    return json(res, 502, { ok: false, error: 'We could not save your request. Please email hello@thestrongacademy.com.' });
  }

  const mail = await notify(lead);   // best effort; the lead is already stored
  if (!mail.sent) console.warn('lead: stored but not emailed —', mail.reason);

  return json(res, 200, { ok: true, id: saved && saved.id, stored: store.mode, emailed: mail.sent });
};
