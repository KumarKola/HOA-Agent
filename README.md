# Liberty Gates

Gate problem reporting for the Liberty community (Phoenix 85041). Residents report a gate problem in three taps; the site files it with City Property by email, merges duplicate reports, escalates after 48 hours and tracks every incident until it is fixed.

- `/`: report a problem: entrance (G1–G4 on the map) → gate (entrance, exit, pedestrian) → problem
- `/dashboard`: public gate status: open incidents, monthly counts, time to fix
- `/admin`: volunteer liaison: add CityCync ticket numbers, mark incidents fixed (passcode)

## Entrances

From the recorded plats for Liberty 1A, 1B and 2. Each entrance has an entrance gate, an exit gate and a pedestrian gate.

| ID | Location |
| --- | --- |
| G1 | 25th Ave & Roeser Rd |
| G2 | La Salle St & 27th Ave |
| G3 | Sunland Ave & 23rd Ave |
| G4 | 25th Ave & Southern Ave |

Edit `lib/gates.ts` to change names, gates or problem types.

## How it behaves

- **Duplicate merging:** one open incident per entrance + gate + problem. More reports, or a tap on **Me too**, add to its count. One Me too per device.
- **Fob check:** "Fob not working" asks whether other residents' fobs work. If yes, the resident is sent to City Property's portal and no incident is opened.
- **Security reports:** "Intruder or suspicious activity" shows a call-911 banner and is logged as an incident.
- **Email:** each new incident emails the community manager (liaison copied) with notes, names and lot numbers. Names never appear on the public dashboard.
- **Escalation:** a daily job emails the manager and HOA president about incidents open more than 48 hours, once each. Incidents open more than 7 days show red on the dashboard.
- **Monthly summary:** on the 1st, the board gets last month's counts per entrance and gate, average time to fix, and the longest open incident.
- **Spam limit:** 8 reports per device per hour. IP addresses are stored only as salted hashes.

## Run locally

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSCODE at least
npm run dev                  # http://localhost:3000
```

With no `DATABASE_URL`, an embedded Postgres (PGlite) is stored in `./.data`. Without `RESEND_API_KEY`, emails are printed to the terminal.

## Deploy (free tiers)

1. **Database:** create a Supabase project. Copy *Project Settings → Database → Connection string → Transaction pooler* into `DATABASE_URL`. Tables are created automatically on first request.
2. **Email:** create a Resend account, verify a sending domain (or use `onboarding@resend.dev` for testing), and set `RESEND_API_KEY` and `EMAIL_FROM`.
3. **Hosting:** import the repo in Vercel and add every variable from `.env.example`. `vercel.json` schedules the escalation job daily at 8:00 am Arizona time and the monthly summary on the 1st.
4. Set `SITE_URL` to the deployed address, and pin the link in the neighborhood WhatsApp group.

On Vercel's free plan cron jobs run once a day, so escalation emails go out between 48 and 72 hours after the first report.

## Phase 3 hook

Gate sensors will post to the same incident logic with `source: 'sensor'` (`submitReport` in `lib/incidents.ts`). No sensor endpoint is exposed yet.
