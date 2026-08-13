/* Calendly API v2 client — fetch only, no SDK.
 *
 * Env vars:
 *   CALENDLY_TOKEN          Personal Access Token (Calendly → Integrations → API)
 *   CALENDLY_WEBHOOK_KEY    signing key returned when the webhook subscription
 *                           is created; used to verify inbound payloads
 */
'use strict';

const crypto = require('crypto');

const API = 'https://api.calendly.com';
const TOKEN = process.env.CALENDLY_TOKEN || '';

const configured = () => Boolean(TOKEN);

async function call(pathname, { method = 'GET', body } = {}) {
  if (!TOKEN) throw Object.assign(new Error('CALENDLY_TOKEN is not set'), { status: 503 });
  const res = await fetch(API + pathname, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`Calendly ${method} ${pathname} failed (${res.status}): ${text.slice(0, 300)}`),
      { status: res.status });
  }
  return text ? JSON.parse(text) : null;
}

/* The current user, and the organization/user URIs other calls need. */
async function me() {
  const r = await call('/users/me');
  return r.resource;
}

/* Bookable event types — what the site maps its services and classes onto. */
async function eventTypes() {
  const user = await me();
  const r = await call(`/event_types?user=${encodeURIComponent(user.uri)}&active=true&count=100`);
  return (r.collection || []).map(t => ({
    uri: t.uri,
    name: t.name,
    slug: t.slug,
    duration: t.duration,
    scheduling_url: t.scheduling_url,
    active: t.active,
    kind: t.kind,
  }));
}

/* Upcoming booked meetings — used to show real bookings in the CRM. */
async function scheduledEvents({ minStart } = {}) {
  const user = await me();
  const qs = new URLSearchParams({ user: user.uri, count: '100', status: 'active', sort: 'start_time:asc' });
  if (minStart) qs.set('min_start_time', minStart);
  const r = await call('/scheduled_events?' + qs.toString());
  return r.collection || [];
}

/* One-off event types can be created through the API; recurring ones must
   be made in the Calendly UI. Surfaced so the admin can spin up a single
   session without leaving the site. */
async function createOneOff({ name, duration, startDate, endDate, timezone, location }) {
  const user = await me();
  return call('/one_off_event_types', {
    method: 'POST',
    body: {
      name,
      host: user.uri,
      duration,
      timezone: timezone || 'America/New_York',
      date_setting: { type: 'date_range', start_date: startDate, end_date: endDate },
      location: location || { kind: 'custom', location: 'Details to follow' },
    },
  });
}

async function createWebhook(url, events) {
  const user = await me();
  return call('/webhook_subscriptions', {
    method: 'POST',
    body: {
      url,
      events: events || ['invitee.created', 'invitee.canceled'],
      organization: user.current_organization,
      user: user.uri,
      scope: 'user',
    },
  });
}

/* Calendly signs webhooks like Stripe: "t=<unix>,v1=<hmac>" over "<t>.<body>" */
function verifySignature(rawBody, header, key) {
  const signingKey = key || process.env.CALENDLY_WEBHOOK_KEY || '';
  if (!signingKey || !header) return false;

  const parts = String(header).split(',').reduce((m, kv) => {
    const [k, v] = kv.split('=');
    if (k && v) m[k.trim()] = v.trim();
    return m;
  }, {});
  if (!parts.t || !parts.v1) return false;

  // reject stale payloads (replay guard) — 5 minute window
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto.createHmac('sha256', signingKey)
    .update(`${parts.t}.${rawBody}`).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  configured, me, eventTypes, scheduledEvents, createOneOff, createWebhook, verifySignature,
};
