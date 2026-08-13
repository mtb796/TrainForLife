#!/usr/bin/env node
/* One-time Calendly webhook registration.
 *
 *   CALENDLY_TOKEN=xxx SITE_URL=https://thestrongacademy.com \
 *     node scripts/setup-calendly.js
 *
 * Prints the signing key — copy it into CALENDLY_WEBHOOK_KEY in Vercel,
 * then redeploy. Without that key the webhook rejects every payload.
 */
'use strict';

const TOKEN = process.env.CALENDLY_TOKEN;
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');

if (!TOKEN || !SITE) {
  console.error('Set CALENDLY_TOKEN and SITE_URL first.\n' +
    'e.g. CALENDLY_TOKEN=eyJ… SITE_URL=https://thestrongacademy.com node scripts/setup-calendly.js');
  process.exit(1);
}

const api = async (p, init) => {
  const r = await fetch('https://api.calendly.com' + p, {
    ...init,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};

(async () => {
  const me = (await api('/users/me')).resource;
  console.log('Connected as', me.name, '—', me.email);

  const url = SITE + '/api/calendly/webhook';
  const existing = await api(
    `/webhook_subscriptions?organization=${encodeURIComponent(me.current_organization)}` +
    `&user=${encodeURIComponent(me.uri)}&scope=user&count=100`);

  const dupe = (existing.collection || []).find(w => w.callback_url === url);
  if (dupe) {
    console.log('\nA webhook for this URL already exists:', dupe.uri);
    console.log('Delete it in Calendly if you need a fresh signing key, then re-run.');
    return;
  }

  const created = await api('/webhook_subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      url,
      events: ['invitee.created', 'invitee.canceled'],
      organization: me.current_organization,
      user: me.uri,
      scope: 'user',
    }),
  });

  const r = created.resource || created;
  console.log('\n✅ Webhook registered:', r.uri);
  console.log('\nAdd this to Vercel → Settings → Environment Variables, then redeploy:');
  console.log('\n  CALENDLY_WEBHOOK_KEY =', r.signing_key || '(check the API response above)');
  console.log('\nEvent types currently bookable:');
  const types = await api(`/event_types?user=${encodeURIComponent(me.uri)}&active=true&count=100`);
  (types.collection || []).forEach(t => console.log(`  • ${t.name} (${t.duration} min) → ${t.scheduling_url}`));
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
