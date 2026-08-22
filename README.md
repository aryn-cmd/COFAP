# COFAP

COFAP is a weekly accountability platform for Fitness, Academics, and Placements. Members log meaningful work, earn FAP points, and compete on a shared team leaderboard.

## Point rules

- Academic: 4 points per task
- Fitness: 3 points per workout session
- Miscellaneous: 2 points per meaningful task
- Platinum: 60+ points per week
- Gold: 50-59 points
- Silver: 40-49 points
- Bronze: 30-39 points
- Unranked: below 30 points

## Project files

- `index.html`: public welcome screen and dashboard markup
- `styles.css`: visual design and responsive layout
- `app.js`: authentication, team actions, activity UI, and leaderboard behavior
- `supabase-config.js`: public Supabase project configuration
- `supabase-schema.sql`: database tables, security policies, and team functions

## Supabase setup

1. Create or open the Supabase project.
2. In **SQL Editor**, run `supabase-schema.sql`.
3. In **Authentication -> URL Configuration**, set the Site URL to your deployed Vercel URL.
4. Add this redirect pattern, replacing the domain:

   `https://your-project.vercel.app/**`

The frontend uses only the Supabase publishable/anon key. Never put a service-role key, database password, or other secret in this project.

## Run locally

Because authentication and browser modules work best over HTTP, run a local static server from this folder:

```powershell
python -m http.server 5500
```

Open `http://localhost:5500` in your browser.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New -> Project** and import the repository.
3. Leave the build command and output directory empty.
4. Deploy.
5. Copy the Vercel URL into Supabase Authentication URL Configuration.

Vercel serves this as a static site. Supabase provides authentication and shared database storage.

## Current product status

Authentication and team create/join actions are wired to Supabase. The next integration step is to load the selected team from `group_members` and read/write activities from the `activities` table so the leaderboard is shared across every device.
