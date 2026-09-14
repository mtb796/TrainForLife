/* Storage layer.
 *
 * Production: Supabase over its REST API using plain fetch — no npm
 * dependency, so the site keeps deploying with no build step.
 * Local dev / tests: a JSON file under .data/ so the handlers can be
 * exercised without any cloud service.
 *
 * Required env vars in production (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL              https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY      the service_role key — SERVER ONLY, never ship
 *                             this to the browser
 *
 * Run db/schema.sql once in the Supabase SQL editor to create the tables.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const URL_BASE = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const LIVE = Boolean(URL_BASE && SERVICE_KEY);

/* ---------------- local JSON fallback ---------------- */

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'crm.json');

function readLocal() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { leads: [], events: [] }; }
}
function writeLocal(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}
function localId(rows) {
  return rows.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
}

/* ---------------- Supabase REST ---------------- */

async function sb(table, { method = 'GET', query = '', body, prefer } = {}) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${URL_BASE}/rest/v1/${table}${query}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Supabase ${method} ${table} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/* ---------------- public API ---------------- */

const LEAD_FIELDS = [
  'name', 'email', 'phone', 'source', 'interest', 'message',
  'event_title', 'event_date', 'status', 'calendly_uri', 'notes', 'follow_up', 'meta',
];

function clean(lead) {
  const out = {};
  for (const k of LEAD_FIELDS) {
    if (lead[k] === undefined || lead[k] === null) continue;
    out[k] = typeof lead[k] === 'string' ? lead[k].trim().slice(0, 2000) : lead[k];
  }
  out.status = out.status || 'new';
  return out;
}

const OPEN_STATUSES = ['new', 'contacted', 'booked'];

const store = {
  live: LIVE,
  mode: LIVE ? 'supabase' : 'local-json',

  async addLead(lead) {
    const row = clean(lead);
    if (LIVE) {
      // de-dupe an identical pending request for the same class
      if (row.email && row.event_title) {
        const dup = await sb('leads', {
          query: `?email=eq.${encodeURIComponent(row.email)}` +
                 `&event_title=eq.${encodeURIComponent(row.event_title)}&limit=1`,
        });
        if (dup && dup.length) return dup[0];
      }
      const created = await sb('leads', {
        method: 'POST', body: row, prefer: 'return=representation',
      });
      return Array.isArray(created) ? created[0] : created;
    }
    const db = readLocal();
    const dup = db.leads.find(l => l.email === row.email && l.event_title === row.event_title && row.event_title);
    if (dup) return dup;
    const rec = Object.assign({ id: localId(db.leads), created_at: new Date().toISOString() }, row);
    db.leads.unshift(rec);
    writeLocal(db);
    return rec;
  },

  async listLeads({ status, source, q, due, limit = 200 } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    if (LIVE) {
      const parts = [`order=created_at.desc`, `limit=${Math.min(+limit || 200, 1000)}`];
      if (due) {
        parts.push(`follow_up=lte.${today}`);
        parts.push(`status=in.(${OPEN_STATUSES.join(',')})`);
      }
      if (status && status !== 'all') parts.push(`status=eq.${encodeURIComponent(status)}`);
      if (source && source !== 'all') parts.push(`source=eq.${encodeURIComponent(source)}`);
      if (q) {
        const term = `*${String(q).replace(/[*,()]/g, '')}*`;
        parts.push(`or=(name.ilike.${term},email.ilike.${term},event_title.ilike.${term})`);
      }
      return (await sb('leads', { query: '?' + parts.join('&') })) || [];
    }
    let rows = readLocal().leads;
    if (due) {
      rows = rows.filter(r => r.follow_up && r.follow_up <= today && OPEN_STATUSES.includes(r.status));
    }
    if (status && status !== 'all') rows = rows.filter(r => r.status === status);
    if (source && source !== 'all') rows = rows.filter(r => r.source === source);
    if (q) {
      const t = String(q).toLowerCase();
      rows = rows.filter(r => [r.name, r.email, r.event_title]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(t)));
    }
    return rows.slice(0, +limit || 200);
  },

  async updateLead(id, patch) {
    const allowed = {};
    if (patch.status) allowed.status = String(patch.status).slice(0, 40);
    if (patch.notes !== undefined) allowed.notes = String(patch.notes).slice(0, 4000);
    if (patch.follow_up !== undefined) {
      // empty string clears the date rather than storing ''
      const d = String(patch.follow_up).trim();
      allowed.follow_up = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    }
    if (!Object.keys(allowed).length) return null;

    if (LIVE) {
      const rows = await sb('leads', {
        method: 'PATCH', query: `?id=eq.${encodeURIComponent(id)}`,
        body: allowed, prefer: 'return=representation',
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }
    const db = readLocal();
    const rec = db.leads.find(l => String(l.id) === String(id));
    if (!rec) return null;
    Object.assign(rec, allowed);
    writeLocal(db);
    return rec;
  },

  async deleteLead(id) {
    if (LIVE) { await sb('leads', { method: 'DELETE', query: `?id=eq.${encodeURIComponent(id)}` }); return true; }
    const db = readLocal();
    const before = db.leads.length;
    db.leads = db.leads.filter(l => String(l.id) !== String(id));
    writeLocal(db);
    return db.leads.length < before;
  },

  /* ---------------- admin account ----------------
   * One row. Holds the username and the scrypt hash of the password Venus
   * chose for herself, so the credentials live in the database rather than
   * in an environment variable somebody else can read.
   */

  async getAdminAccount() {
    if (LIVE) {
      try {
        const rows = await sb('admin_account', { query: '?id=eq.1&limit=1' });
        return (rows && rows[0]) || null;
      } catch (e) {
        // The table may not exist yet on a database created before this
        // feature. Treat that as "no account" so the bootstrap login still
        // works and the setup screen can explain what to run.
        if (e.status === 404 || e.status === 400) return null;
        throw e;
      }
    }
    return readLocal().admin || null;
  },

  async saveAdminAccount({ username, password_hash }) {
    const row = { id: 1, username, password_hash, updated_at: new Date().toISOString() };
    if (LIVE) {
      await sb('admin_account', {
        method: 'POST', body: row,
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
      return row;
    }
    const db = readLocal();
    db.admin = row;
    writeLocal(db);
    return row;
  },

  async stats() {
    const rows = await store.listLeads({ limit: 1000 });
    const by = (key) => rows.reduce((m, r) => {
      const k = r[key] || 'unknown'; m[k] = (m[k] || 0) + 1; return m;
    }, {});
    const today = new Date().toISOString().slice(0, 10);
    const due = rows.filter(r => r.follow_up && r.follow_up <= today &&
      OPEN_STATUSES.includes(r.status)).length;
    return { total: rows.length, due: due, byStatus: by('status'), bySource: by('source') };
  },
};

module.exports = store;
