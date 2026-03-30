# Simple Discord Bot (Reset Structure)

The old slash commands were removed.

The bot now loads commands from two separate folders:

- `src/commands/admin` for admin-only commands
- `src/commands/member` for regular member commands

This gives you a clean base to add new commands next.

## Setup

1. Create a Discord application and bot in Discord Developer Portal.
2. Enable these bot intents:
   - Server Members Intent
3. Invite the bot to your server with scopes:
   - `bot`
   - `applications.commands`
4. Copy `.env.example` to `.env` and fill values:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
5. Install dependencies:
   - `npm install`
6. Run the bot:
   - `npm start`

## Website Integration

This bot supports website-backed stats sync.

Member command:

- `/webstats`

Admin command:

- `/websyncstatus` (optional `refresh`)

See [WEBSITE_INTEGRATION.md](WEBSITE_INTEGRATION.md) for endpoint contract and website script examples.

## Command File Format

Each command file should export:

- `data`: a `SlashCommandBuilder`
- `execute`: `async (interaction, context) => { ... }`

Example structure:

```js
module.exports = {
   data, // SlashCommandBuilder instance
   async execute(interaction, context) {
      // command logic
   },
};
```

## Notes

- Slash commands are registered only for the server in `GUILD_ID` for fast updates.
- If there are no command files, the bot will register 0 guild commands.
