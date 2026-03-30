const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getWebsiteSyncState, syncWebsiteStats } = require("../../../services/websiteSync");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("websyncstatus")
    .setDescription("Show website sync health and cached stats")
    .addBooleanOption((option) =>
      option
        .setName("refresh")
        .setDescription("Run a fresh sync before showing status")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const shouldRefresh = interaction.options.getBoolean("refresh") || false;

    await interaction.deferReply({ ephemeral: true });

    if (shouldRefresh) {
      await syncWebsiteStats();
    }

    const syncState = getWebsiteSyncState();
    const lastAttempt = syncState.lastAttemptAt ? `<t:${Math.floor(syncState.lastAttemptAt / 1000)}:R>` : "Never";
    const lastSuccess = syncState.lastSuccessAt ? `<t:${Math.floor(syncState.lastSuccessAt / 1000)}:R>` : "Never";

    const embed = new EmbedBuilder()
      .setColor("#B00000")
      .setTitle("Website Sync Status")
      .addFields(
        {
          name: "Sync Config",
          value: [
            `Enabled: ${syncState.enabled ? "Yes" : "No"}`,
            `API Configured: ${syncState.apiConfigured ? "Yes" : "No"}`,
            `Interval: ${syncState.intervalMinutes} minute(s)`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Last Activity",
          value: [
            `Last Attempt: ${lastAttempt}`,
            `Last Success: ${lastSuccess}`,
            `Last Error: ${syncState.lastError || "None"}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Cached Stats",
          value: syncState.lastStats
            ? [
                `Source: ${syncState.lastStats.source || "unknown"}`,
                `Players: ${syncState.lastStats.players ?? "N/A"}`,
                `Factions: ${syncState.lastStats.factions ?? "N/A"}`,
                `Countries: ${syncState.lastStats.countries ?? "N/A"}`,
              ].join("\n")
            : "No cached data yet.",
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
