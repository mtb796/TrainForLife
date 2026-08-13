/* Protected Calendly bridge for the admin UI.
 *   GET  ?action=event-types   -> bookable event types (map these to services)
 *   GET  ?action=scheduled     -> upcoming booked meetings
 *   POST { action:'one-off', name, duration, startDate, endDate }
 *        -> creates a one-off event type and returns its booking URL
 *
 * Recurring event types cannot be created through Calendly's API; those are
 * made in the Calendly UI and then mapped here.
 */
'use strict';

const calendly = require('../_lib/calendly');
const { requireAdmin } = require('../_lib/auth');
const { readBody, json, methodGuard, str } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['GET', 'POST'])) return;
  if (requireAdmin(req, res)) return;

  if (!calendly.configured()) {
    return json(res, 503, {
      ok: false,
      error: 'Calendly is not connected. Add CALENDLY_TOKEN in Vercel to enable this.',
    });
  }

  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET') {
      const action = url.searchParams.get('action') || 'event-types';
      if (action === 'scheduled') {
        const events = await calendly.scheduledEvents({ minStart: new Date().toISOString() });
        return json(res, 200, {
          ok: true,
          events: events.map(e => ({
            uri: e.uri, name: e.name, start: e.start_time, end: e.end_time,
            status: e.status, invitees: e.invitees_counter,
          })),
        });
      }
      return json(res, 200, { ok: true, eventTypes: await calendly.eventTypes() });
    }

    const body = await readBody(req);
    if (body.action !== 'one-off') {
      return json(res, 400, { ok: false, error: 'Unknown action.' });
    }
    const name = str(body.name, 120);
    const duration = Math.min(Math.max(parseInt(body.duration, 10) || 60, 15), 480);
    if (!name) return json(res, 400, { ok: false, error: 'Give the session a name.' });
    if (!body.startDate || !body.endDate) {
      return json(res, 400, { ok: false, error: 'Start and end dates are required.' });
    }

    const created = await calendly.createOneOff({
      name, duration,
      startDate: str(body.startDate, 10),
      endDate: str(body.endDate, 10),
      timezone: str(body.timezone, 60) || 'America/New_York',
    });

    const r = created && created.resource ? created.resource : created;
    return json(res, 200, { ok: true, name, schedulingUrl: r && r.scheduling_url, raw: r });
  } catch (e) {
    console.error('admin/calendly failed', e);
    return json(res, e.status || 502, { ok: false, error: e.message || 'Calendly request failed.' });
  }
};
