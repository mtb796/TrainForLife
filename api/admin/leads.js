/* Protected CRM data.
 *   GET    ?status=&source=&q=&limit=   -> { leads, stats }
 *   PATCH  { id, status?, notes? }      -> updated row
 *   DELETE ?id=                         -> { ok }
 *   GET    ?format=csv                  -> CSV download
 */
'use strict';

const store = require('../_lib/store');
const { requireAdmin } = require('../_lib/auth');
const { readBody, json, methodGuard } = require('../_lib/http');

const CSV_COLS = ['id', 'created_at', 'status', 'source', 'name', 'email', 'phone',
  'interest', 'event_title', 'event_date', 'message', 'notes'];

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLS.join(','), ...rows.map(r => CSV_COLS.map(c => esc(r[c])).join(','))].join('\n');
}

module.exports = async function handler(req, res) {
  if (methodGuard(req, res, ['GET', 'PATCH', 'DELETE'])) return;
  if (requireAdmin(req, res)) return;

  const url = new URL(req.url, 'http://localhost');
  const qp = Object.fromEntries(url.searchParams);

  try {
    if (req.method === 'GET') {
      const leads = await store.listLeads({
        status: qp.status, source: qp.source, q: qp.q, limit: qp.limit,
      });

      if (qp.format === 'csv') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition',
          `attachment; filename="strong-academy-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.end(toCsv(leads));
      }

      return json(res, 200, { ok: true, leads, stats: await store.stats(), storage: store.mode });
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      if (!body.id) return json(res, 400, { ok: false, error: 'id is required.' });
      const updated = await store.updateLead(body.id, body);
      if (!updated) return json(res, 404, { ok: false, error: 'Lead not found, or nothing to change.' });
      return json(res, 200, { ok: true, lead: updated });
    }

    // DELETE
    if (!qp.id) return json(res, 400, { ok: false, error: 'id is required.' });
    await store.deleteLead(qp.id);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('admin/leads failed', e);
    return json(res, 500, { ok: false, error: 'Something went wrong reading the CRM.' });
  }
};
