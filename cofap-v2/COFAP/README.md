# COFAP

COFAP is a weekly accountability platform for Fitness, Academics, and Placements. Members log meaningful work, earn FAP points, and compete on team leaderboards.

This is a Vite + React single-page app talking directly to Supabase (auth, Postgres, Realtime) — no separate backend server.

## Point rules

- Academic: 1 point per hour logged, capped at 8 hours/person/day
- Fitness: 3 points per session
- Miscellaneous: 2 points per meaningful task
- Platinum: 60+ points (no upper cap — 60 is the last named tier, not a ceiling)
- Gold: 50-59 · Silver: 40-49 · Bronze: 30-39 · Unranked: below 30

Points are computed **server-side** by a database trigger — the client never gets to set its own point value.

## Project layout

```
index.html            Vite entry
src/main.jsx           React root
src/App.jsx             Auth/profile bootstrapping + route table
src/lib/supabase.js     Supabase client
src/styles.css          All styling
src/components/         Layout (sidebar/topbar/toast), NotificationBell
src/pages/               One file per route: Auth, Onboard, Dashboard, Activity,
                          Leaderboard, Teams, TeamDetail, Notifications, Profile, Admin
supabase-schema.sql       Full database schema — run this in Supabase's SQL editor
```

## Supabase setup

1. Open your Supabase project → **SQL Editor** → paste and run the whole of `supabase-schema.sql`. It's idempotent, so re-running it later after edits is safe.
2. Make yourself admin — sign up in the running app first with the email you want as admin, then run (see the bottom of `supabase-schema.sql` for the exact statement):
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. **Authentication → URL Configuration**: set the Site URL to your deployed domain, and add a redirect pattern for it (e.g. `https://your-app.vercel.app/**`).
4. **Database → Extensions**: confirm `pg_cron` is enabled (the schema tries to enable it itself, but some plans require doing this from the dashboard). This only powers the nightly cleanup of completed 30-day team departures — everything else works without it.

Only the Supabase **anon/publishable key** is used client-side. Never put a service-role key or DB password in this project.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your Supabase project URL and publishable key first (a working `.env` is already included in this handoff, pointed at the project you've been using).

## Deployment

See the deployment notes in the chat message this was delivered with — short version: same Vercel + Supabase you already have, but Vercel needs to build this now (it's no longer static HTML), and your Supabase anon key needs to be added as an **environment variable** in Vercel rather than just living in a committed file.
