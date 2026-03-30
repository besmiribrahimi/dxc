Place admin-only slash command files here.

Each command file should export:
- data: SlashCommandBuilder
- execute: async function (interaction, context)

Commands in this folder are restricted to administrators by src/index.js.
