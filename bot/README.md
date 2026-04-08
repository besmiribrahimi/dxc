# Ascend Entrenched Bot Webhook Bridge

Node.js Discord bot improvement using:
- discord.js v14
- Express REST listener
- Queue-based rate limiting for burst updates
- Modular event handlers (leaderboard, highlights, substitutions)

## 1) Setup

1. Open a terminal in `bot`.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env`.
4. Fill these required values:
- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`

Optional security and queue tuning:
- `DISCORD_GUILD_ID` (recommended for instant slash command updates)
- `LEADERBOARD_API_URL` (required for `/leaderboard` command)
- `APPLICATIONS_CHANNEL_ID` (required for Appy-style application review)
- `APPLICATIONS_REVIEWER_ROLE_ID` (optional role for application reviewers)
- `APPLICATIONS_ACCEPTED_ROLE_ID` (optional auto-role on accepted applications)
- `APPLICATION_COOLDOWN_MS` (optional anti-spam cooldown for `/apply`)
- `WEBHOOK_SHARED_SECRET`
- `QUEUE_INTERVAL_MS`
- `MAX_QUEUE_SIZE`
- `PORT`

## 2) Run

```bash
npm start
```

Dev watch mode:

```bash
npm run dev
```

## 3) API Endpoint

POST updates to:

`/webhook/update`

Health endpoint:

`/health`

If `WEBHOOK_SHARED_SECRET` is set, include header:

`x-webhook-secret: your_shared_secret`

## 3.1) Slash Commands

The bot auto-registers these commands at startup:

- `/ping` - bot latency/health
- `/queue` - webhook queue size and rate
- `/leaderboard` - fetch and show top synced leaderboard directly from web API
- `/apply` - submit an application modal like Appy-style bots
- `/webhooktest` - queue a test leaderboard embed
- `/mute` - timeout a member (admin/mod command)
- `/kick` - kick a member (admin/mod command)
- `/ban` - ban a user (admin/mod command)

Application flow:
- User runs `/apply` and submits a modal
- Bot posts application embed in `APPLICATIONS_CHANNEL_ID`
- Staff review with Accept/Reject buttons
- Applicant receives DM result
- Optional accepted role is granted when approved

If `DISCORD_GUILD_ID` is set, commands appear quickly in that guild.
If not set, commands register globally and can take up to 1 hour to appear.

## 4) Web Payload Example

### Standard leaderboard update (your current format)

```json
{
  "group": "H",
  "player": "20SovietSO21",
  "status": "winner",
  "score": 42,
  "matchHighlight": "Player scored a double kill"
}
```

### Optional event type: highlight

```json
{
  "eventType": "highlight",
  "group": "H",
  "player": "20SovietSO21",
  "status": "info",
  "score": 42,
  "matchHighlight": "Player scored a double kill"
}
```

### Optional event type: substitution

```json
{
  "eventType": "substitution",
  "group": "H",
  "playerOut": "Player_A",
  "playerIn": "Player_B",
  "reason": "Tactical swap"
}
```

## 5) Embed Rules Implemented

- Title: `Group {group} Update` (leaderboard)
- Fields: Player, Status, Score, Match Highlight
- Colors:
  - winner = Green
  - eliminated = Red
  - info = Blue

## 6) Extension Notes

The project is intentionally modular:

- `src/events/leaderboard.js`: leaderboard embed builder
- `src/events/matchHighlights.js`: highlight embed builder
- `src/events/substitutions.js`: substitution embed builder
- `src/validators/payloadValidators.js`: per-event validation
- `src/events/index.js`: event type routing and dispatch

To add a future event:
1. Create a new event module in `src/events`.
2. Add validation in `src/validators/payloadValidators.js`.
3. Register routing in `src/events/index.js`.
