-- The Strong Academy — CRM schema
-- Run once in Supabase → SQL Editor → New query → Run.

create table if not exists leads (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),

  name          text,
  email         text not null,
  phone         text,

  -- waitlist | newsletter | corporate | contact | booking
  source        text not null default 'contact',
  interest      text,
  message       text,

  -- set when the lead came from a class or a Calendly booking
  event_title   text,
  event_date    text,
  calendly_uri  text,

  -- new | contacted | booked | won | lost | cancelled
  status        text not null default 'new',
  notes         text,
  meta          jsonb
);

create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_status_idx  on leads (status);
create index if not exists leads_source_idx  on leads (source);
create index if not exists leads_email_idx   on leads (email);

-- Lock the table down. The site talks to Supabase only from serverless
-- functions using the service_role key, which bypasses RLS. Enabling RLS
-- with no policies means the anon/public key can read nothing, so a leaked
-- publishable key still exposes zero personal data.
alter table leads enable row level security;

-- Optional: keep a copy of every Calendly webhook for troubleshooting.
create table if not exists calendly_events (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),
  event        text,
  payload      jsonb
);
alter table calendly_events enable row level security;
