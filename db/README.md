# Backend setup

The site is static plus a handful of Vercel Serverless Functions in `/api`.
There is still **no build step and no npm dependency** — everything talks to
its service over plain `fetch`.

Nothing below is required for the site to render. Each piece is optional and
degrades honestly when its environment variables are missing: the CRM says it
isn't configured, Calendly says it isn't connected, and the waitlist falls back
to a pre-filled email rather than pretending a signup was captured.

---

## 1. Database (Supabase) — stores every inquiry

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste all of `db/schema.sql`, and Run.
3. **Project Settings → API** gives you two values.

Add to **Vercel → Settings → Environment Variables**:

| Variable | Where it comes from |
|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Project Settings → API → `service_role` key |

> The `service_role` key bypasses row-level security. It is only ever read by
> serverless functions and must never be put in client-side code or committed.
> The schema enables RLS with no policies, so even a leaked *public* key reads
> nothing.

Without these the API writes to a local JSON file, which does **not** survive a
redeploy. The CRM shows a warning while that's the case.

## 2. CRM access

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | the password used at `/admin/crm` |
| `SESSION_SECRET` | a long random string, e.g. `openssl rand -base64 32` |

Both must be set or the admin API refuses every request — it fails closed
rather than defaulting open.

## 3. Email notifications

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | from [resend.com](https://resend.com), free tier is plenty |
| `WAITLIST_TO` | `hello@thestrongacademy.com` |
| `WAITLIST_FROM` | an address on your verified sending domain |

Inquiries are saved first and emailed second, so a mail outage never loses a lead.

## 4. Calendly

| Variable | Value |
|---|---|
| `CALENDLY_TOKEN` | Calendly → Integrations → API & Webhooks → personal access token |
| `CALENDLY_WEBHOOK_KEY` | printed by the setup script below |

```bash
CALENDLY_TOKEN=xxx SITE_URL=https://thestrongacademy.com node scripts/setup-calendly.js
```

That registers `invitee.created` / `invitee.canceled` against
`/api/calendly/webhook` and prints the signing key.

---

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/lead` | public | every form on the site — waitlist, newsletter, corporate, contact |
| `POST /api/calendly/webhook` | HMAC signature | bookings and cancellations become CRM records |
| `GET/POST/DELETE /api/admin/login` | password | session in/out |
| `GET/PATCH/DELETE /api/admin/leads` | cookie | list, filter, update status, delete, `?format=csv` |
| `GET/POST /api/admin/calendly` | cookie | list event types, list upcoming meetings, create a one-off |

## Security notes

- Admin routes fail closed when unconfigured, and the session cookie is
  HttpOnly + Secure + SameSite=Strict, signed with HMAC-SHA256.
- The Calendly webhook verifies the HMAC signature and rejects payloads older
  than five minutes, so a replayed or forged POST can't inject records.
- `/api/lead` has a honeypot field, per-IP throttling, and length caps.
- Storage failures return an error to the visitor rather than a false success.

## Local development

```bash
# from the repo root
LOCAL_DATA_DIR=./.data ADMIN_PASSWORD=dev SESSION_SECRET=dev-secret \
CALENDLY_WEBHOOK_KEY=dev-key node scripts/devserver.js 8790
```

Leads are written to `.data/crm.json`. That directory is git-ignored.
