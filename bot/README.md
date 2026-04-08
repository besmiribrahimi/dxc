# Ascend Entrenched Bot

Discord bot for esports operations with:
- Ticket-based submissions (modal + dedicated channels)
- Synced leaderboard from web API
- User profile lookup for competitive info
- Admin setup flow in Discord (`/setup`)
- Webhook bridge for live event embeds

## Setup

1. Open terminal in `bot`
2. Install deps:

```bash
npm install
```

3. Copy `.env.example` to `.env`
4. Fill required values:
- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`

Recommended:
- `DISCORD_GUILD_ID` for instant guild command registration
- `LEADERBOARD_API_URL` (for `/leaderboard` and `/userinfo`)

## Run

```bash
npm start
```

Dev mode:

```bash
npm run dev
```

## Ticket Flow

1. Admin posts panel using `/ticketpanel`
2. User clicks `Create Ticket`
3. Modal asks:
- Roblox Username
- Country
- Faction
4. Bot creates private ticket channel
5. Staff roles are pinged
6. Ticket supports:
- Status buttons (`Open`, `Waiting User`, `In Review`, `Escalated`, `Resolved`)
- Follow-up command `/ticketupdate`
- Close modal with reason
7. Optional logging:
- Ticket log channel (`/setup tickets log_channel`)
- Local audit file (`bot/ticket-audit.log`)

## Commands

- `/ping` - latency check
- `/queue` - webhook queue status
- `/ticketpanel` - post ticket button panel
- `/ticketupdate note status?` - follow-up + optional status change
- `/userinfo user` - Roblox/faction/country/matches/leaderboard status
- `/leaderboard limit? page_size? post?` - synced paginated leaderboard
- `/setup ...` - server admin setup (tickets, access, leaderboard, style)
- `/webhooktest ...` - queue a test leaderboard embed
- `/mute`, `/kick`, `/ban` - moderation commands

## Setup Command Guide

- `/setup view`
- `/setup tickets enabled category log_channel ping_role reviewer_role`
- `/setup ticket_access action role`
- `/setup leaderboard channel endpoint auto_post every_hours`
- `/setup style info_color winner_color active_color eliminated_color highlight_color footer highlight_enabled`

Examples:
- `/setup tickets enabled:true ping_role:@Staff reviewer_role:@Admins`
- `/setup ticket_access action:add role:@Verified`
- `/setup leaderboard endpoint:https://dxc-chi.vercel.app`
- `/setup leaderboard channel:#leaderboard auto_post:true every_hours:6`
- `/setup style winner_color:#FFD700 active_color:#C8A2C8`

Auto-post notes:
- `auto_post:true` enables scheduled posting in the configured leaderboard channel.
- `every_hours` accepts values from 1 to 168.
- The bot checks schedule once per minute and posts when the interval is due.

## Leaderboard Color Rules

- Winners: `#FFD700`
- Active players: `#C8A2C8`
- Eliminated: `#9B59B6`
- Highlights: `#FFECB3`

All embeds include timestamp and branding footer (`Ascend Entrenched` by default).

## Webhook API

- `GET /health`
- `POST /webhook/update`

If `WEBHOOK_SHARED_SECRET` is set, include:
- Header: `x-webhook-secret: your_shared_secret`

## Notes

- Guild-specific setup is persisted in `bot/guild-settings.json`
- User ticket profiles are persisted in `bot/user-profiles.json`
- Runtime changes are safe for multi-guild operation
- Keep bot role above managed roles/channels for moderation and ticket permissions
