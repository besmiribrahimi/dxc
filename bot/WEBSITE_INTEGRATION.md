# Website Integration Guide

This bot supports secure website sync using a JSON endpoint.

## 1) Bot Environment Variables

Add these values to `.env`:

- `WEBSITE_API_URL=https://dxc-chi.vercel.app/api/bot/stats`
- `WEBSITE_API_TOKEN=your_secret_token_here`
- `WEBSITE_HOME_URL=https://dxc-chi.vercel.app/`
- `WEBSITE_LOCAL_SCRIPT_PATH=../draxar/script.js` (optional, for local workspace sync)
- `WEBSITE_SYNC_ENABLED=true`
- `WEBSITE_SYNC_INTERVAL_MINUTES=5`

## 2) Expected API JSON Contract

The bot accepts either root-level stats or nested `stats` object.

Option A:

```json
{
  "players": 42,
  "factions": 12,
  "countries": 22,
  "updatedAt": "2026-03-28T22:30:00.000Z"
}
```

Option B:

```json
{
  "stats": {
    "players": 42,
    "factions": 12,
    "countries": 22,
    "updatedAt": "2026-03-28T22:30:00.000Z"
  }
}
```

## 3) Example Website Script (Vercel / Next.js API Route)

Use this as a base for `app/api/bot/stats/route.js`:

```js
import { NextResponse } from "next/server";

export async function GET(request) {
  const token = request.headers.get("x-bot-token");
  if (!token || token !== process.env.WEBSITE_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Replace these with your real database/query values.
  const stats = {
    players: 42,
    factions: 12,
    countries: 22,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(stats, { status: 200 });
}
```

Also set `WEBSITE_API_TOKEN` in your website hosting environment.

## 4) Bot Commands

- `/webstats` - fetches and shows website stats
- `/webleaderboard` - shows top website players, top factions, and top countries
- `/websyncstatus` - admin-only sync health and cache status (optional `refresh=true`)

## 5) Sync Behavior

- Bot auto-syncs in background every `WEBSITE_SYNC_INTERVAL_MINUTES`.
- Sync priority order is: API endpoint -> local website script (`WEBSITE_LOCAL_SCRIPT_PATH`) -> homepage parsing.
- Local script fallback lets the `draxar bot` folder read `draxar/script.js` directly when both folders are side-by-side.
