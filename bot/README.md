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
