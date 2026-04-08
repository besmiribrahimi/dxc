const { SlashCommandBuilder } = require("discord.js");

const slashCommandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency and health"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show webhook queue status"),
  new SlashCommandBuilder()
    .setName("webhooktest")
    .setDescription("Send a test leaderboard update embed")
    .addStringOption((option) =>
      option
        .setName("group")
        .setDescription("Group label")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("Player name")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status type")
        .setRequired(true)
        .addChoices(
          { name: "winner", value: "winner" },
          { name: "eliminated", value: "eliminated" },
          { name: "info", value: "info" }
        )
    )
    .addNumberOption((option) =>
      option
        .setName("score")
        .setDescription("Score value")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("highlight")
        .setDescription("Match highlight text")
        .setRequired(true)
    )
];

const slashCommands = slashCommandBuilders.map((builder) => builder.toJSON());

async function registerSlashCommands(client, config) {
  if (!client.application) {
    throw new Error("Discord application is not ready for command registration");
  }

  if (config.discordGuildId) {
    await client.application.commands.set(slashCommands, config.discordGuildId);
    return { scope: "guild", guildId: config.discordGuildId, count: slashCommands.length };
  }

  await client.application.commands.set(slashCommands);
  return { scope: "global", count: slashCommands.length };
}

async function handleSlashCommand(interaction, context) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "ping") {
    const wsPing = Math.round(interaction.client.ws.ping || 0);
    await interaction.reply({
      content: `Pong. Websocket ping: ${wsPing} ms`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "queue") {
    await interaction.reply({
      content: `Queue size: ${context.updateQueue.size()} | Rate: 1 message / ${context.config.queueIntervalMs} ms`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "webhooktest") {
    const payload = {
      group: interaction.options.getString("group", true),
      player: interaction.options.getString("player", true),
      status: interaction.options.getString("status", true),
      score: interaction.options.getNumber("score", true),
      matchHighlight: interaction.options.getString("highlight", true)
    };

    context.updateQueue.enqueue(
      async () => context.handleAcceptedEvent(payload, "leaderboard"),
      { source: "slash:webhooktest", group: payload.group }
    );

    await interaction.reply({
      content: "Test update queued and will be sent to the configured channel shortly.",
      ephemeral: true
    });
  }
}

module.exports = {
  registerSlashCommands,
  handleSlashCommand
};
