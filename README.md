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

1. **Database:** in the Vercel project, open *Storage* and add a Postgres database (Neon or Supabase from the Vercel Marketplace). Vercel adds the connection string to the project for you as `DATABASE_URL` or `POSTGRES_URL`; the app reads either. Tables are created automatically on first request.
2. **Email:** create a Resend account, verify a sending domain (or use `onboarding@resend.dev` for testing), and set `RESEND_API_KEY` and `EMAIL_FROM`.
3. **Hosting:** import the repo in Vercel and add every variable from `.env.example`. `vercel.json` schedules the escalation job daily at 8:00 am Arizona time and the monthly summary on the 1st.
4. Set `SITE_URL` to the deployed address, and pin the link in the neighborhood WhatsApp group.

On Vercel's free plan cron jobs run once a day, so escalation emails go out between 48 and 72 hours after the first report.

## Trick-or-treat map

- `/treats`: volunteers add their house by tapping it on the community map (or using their phone's location), with an optional note. Families see every participating house, a list by street, and a "you are here" dot.
- `/treats/admin`: organizer view (sign in on `/admin` first): move a misplaced candy or remove spam. Names are visible only here.
- Set `TREATS_SIGNUP_CLOSES` (YYYY-MM-DD) to close sign-ups after that day.
- Candies snap to the lot that was tapped and are sized to fit it (lot boxes in `lib/treatsLots.ts`, detected from the map image).
- House number is optional; street is required. Signing up again from the same address or lot replaces the earlier entry.
- Optional `GOOGLE_MAPS_API_KEY` (Places API (New) + Geocoding API) adds address suggestions while typing, places the candy at the picked address, and fills the address from "Use my location". Calls go through the server, limited to the community and to 60 lookups per device per 10 minutes.
- The map image is `public/treats-map-v2.jpg` (1600×1424). GPS alignment uses the four perimeter intersections in `lib/treatsGeo.ts`; if the image is replaced with one of a different size or framing, update those pixel positions.

## Holiday decor contest

- `/holiday`: homes enter themselves (tap the home, pick a tree or lights, house number + street required). Neighbors vote for their favorite; winners show with badges on the map.
- Dates (Arizona time, all optional): `HOLIDAY_ENTRY_CLOSES` (default Dec 10), `HOLIDAY_VOTE_OPENS` (Dec 11), `HOLIDAY_VOTE_CLOSES` (Dec 22), `HOLIDAY_RESULTS` (Dec 23), as YYYY-MM-DD. Entries and votes are kept per year (`HOLIDAY_SEASON` overrides); January still shows the past December's winners.
- One vote per address: voters type their house number and pick their street. The phone that voted can change its vote while voting is open; another phone can't vote for the same address, and a phone votes for one address. No one can vote for their own home. Vote counts stay hidden until the results day.
- `/holiday/admin` (sign in on `/admin` first): live standings, every vote with the voting address, remove a vote, move/remove/delete a home, and committee awards such as "Board's Choice" (shown from the results day).
- The map is `public/holiday-map-v2.jpg`: the Halloween map with its art replaced by holiday decorations (drawn only in the margins and open spaces, never on a lot), same size and framing, so lots and GPS line up.
- To try a phase locally, set `HOLIDAY_FAKE_NOW` (ignored on Vercel).
- More than one community can run the contest (`lib/communities.ts`). Liberty is at `/holiday` (organizer `/holiday/admin`); others at `/holiday/<community>` (organizer `/holiday/<community>/admin`, same passcode). Entries, votes and test mode are kept per community.
- Skyline Ranch II (San Tan Valley) is at `/holiday/skyline-ranch-ii`. Its map (`public/skyline-holiday-v3.jpg`) is redrawn from the HOA's tract plat with holiday art in the open areas; street names and the GPS alignment come from OpenStreetMap street centerlines fitted onto the plat's roads (`lib/skylineMap.ts`).

## Phase 3 hook

Gate sensors will post to the same incident logic with `source: 'sensor'` (`submitReport` in `lib/incidents.ts`). No sensor endpoint is exposed yet.
