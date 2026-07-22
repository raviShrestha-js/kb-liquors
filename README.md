# KB Liquors — Stock Management & POS

An offline-first Progressive Web App for KB Liquors: stock/inventory tracking with
photo capture, cash-based POS checkout, daily cash reconciliation, and a sales/profit
dashboard. Works fully offline (records everything locally and syncs when back
online) — built for Nepal's unreliable power/internet.

Runs entirely on free hosting: **Cloudflare Pages** (frontend) + **Supabase**
(database, auth, photo storage).

## Project layout

```
kb-liquors/
  supabase/migrations/   SQL schema, RLS policies, triggers
  web/                    React + TypeScript + Vite PWA
```

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), sign up free, and create a new project.
2. Once it's ready, open the **SQL Editor** and paste in the full contents of
   [`supabase/migrations/0001_init_schema.sql`](supabase/migrations/0001_init_schema.sql),
   then run it. This creates every table, the stock-decrement trigger, row-level
   security policies, and the `stock-photos` storage bucket.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 2. Configure the app

```bash
cd web
npm install
cp .env.example .env
```

Edit `.env` and paste in your Supabase URL and anon key:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run it locally

```bash
npm run dev
```

Open the printed local URL. Click **"Create shop account"**, enter your shop name
and a login — this automatically creates your store and owner profile (via the
`handle_new_user` trigger in the migration). From there:

1. Go to **Cash** and open a session with your starting cash for the day.
2. Go to **Stock** and add a few items (take/upload a photo from your phone camera).
3. Go to **POS** and ring up a sale.
4. Go to **Dashboard** to see sales/profit and switch between day/week/month/year.

Try turning off Wi-Fi, adding stock and completing a sale, then turning Wi-Fi back
on — the sync badge in the header will show pending items and then clear once synced.

## 4. Deploy for free

**Frontend — Cloudflare Pages:**

1. Push this repo to GitHub.
2. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to **Workers & Pages
   → Create → Pages → Connect to Git** and select this repo.
3. Build settings:
   - Root directory: `web`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (same values as your local `.env`).
5. Deploy. The `public/_redirects` file already routes all paths to `index.html`
   so client-side routing and PWA install work correctly on Cloudflare Pages.

**Backend — Supabase:** nothing to deploy — it's already live from step 1. If you
add more SQL later, run new migration files through the SQL Editor the same way.

## Installing on a phone

Open the deployed URL in Chrome (Android) or Safari (iPhone) and use
"Add to Home Screen" — it installs like a native app and keeps working offline.

## Free-tier limits worth knowing

- **Supabase** free project pauses after 7 days with zero activity (one click to
  resume from the dashboard) — only matters if the shop closes for an extended
  stretch. 1GB photo storage and 2GB/month egress are far more than a single shop
  needs; photos are compressed client-side before upload to stay well under that.
- **Cloudflare Pages** free tier has generous bandwidth/build limits and, unlike
  some other free hosts, doesn't restrict commercial use.

## What's built (Phase 1) vs. what's next

**Built:** stock/inventory with photos, offline-first sync, cash POS checkout,
daily cash open/close reconciliation, day/week/month/year dashboard.

**Deliberately not built yet** (the schema leaves room for these):
bank transaction recording, a supplier directory, an on-demand AI market-research
button, and multi-staff logins with owner-only profit visibility.
