/* Calendly → CRM.
 *
 * Every booking and cancellation lands here and becomes a record, so the
 * CRM shows real appointments alongside inquiries.
 *
 * Register once (see db/README or run: node scripts/setup-calendly.js):
 *   POST https://api.calendly.com/webhook_subscriptions
 *   { url: "https://thestrongacademy.com/api/calendly/webhook",
 *     events: ["invitee.created","invitee.canceled"], scope: "user", ... }
 *
 * Calendly returns a signing key — put it in CALENDLY_WEBHOOK_KEY.
 * Unsigned or stale payloads are rejected; anyone can POST to a public URL.
 */
'use strict';

const store = require('../_lib/store');
const calendly = require('../_lib/calendly');
const { readRaw, json, methodGuard } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['POST'])) return;

  let raw;
  try { raw = await readRaw(req); }
  catch (e) { return json(res, e.status || 400, { ok: false, error: 'Could not read request.' }); }

  const sig = req.headers['calendly-webhook-signature'];
  if (!calendly.verifySignature(raw, sig)) {
    // Also fails when CALENDLY_WEBHOOK_KEY is unset — deliberately closed by default.
    console.warn('calendly webhook: rejected (bad or missing signature)');
    return json(res, 401, { ok: false, error: 'Invalid signature.' });
  }

  let payload;
  try { payload = JSON.parse(raw); }
  catch (e) { return json(res, 400, { ok: false, error: 'Malformed JSON.' }); }

  const event = payload.event;
  const p = payload.payload || {};
  const invitee = p.name || p.email ? p : (p.invitee || {});

  const questions = Array.isArray(p.questions_and_answers) ? p.questions_and_answers : [];
  const answers = questions.map(q => `${q.question}: ${q.answer}`).join('\n').slice(0, 2000);

  const lead = {
    name: invitee.name || '',
    email: invitee.email || '',
    phone: (p.text_reminder_number || '') + '',
    source: 'booking',
    interest: (p.scheduled_event && p.scheduled_event.name) || p.event_type_name || 'Calendly booking',
    event_title: (p.scheduled_event && p.scheduled_event.name) || '',
    event_date: (p.scheduled_event && p.scheduled_event.start_time) || '',
    calendly_uri: p.uri || (p.scheduled_event && p.scheduled_event.uri) || '',
    message: answers,
    status: event === 'invitee.canceled' ? 'cancelled' : 'booked',
  };

  if (!lead.email) return json(res, 200, { ok: true, skipped: 'no invitee email' });

  try {
    await store.addLead(lead);
  } catch (e) {
    console.error('calendly webhook: storage failed', e);
    // 500 so Calendly retries rather than dropping the booking
    return json(res, 500, { ok: false, error: 'Storage failed.' });
  }

  return json(res, 200, { ok: true, event });
};
