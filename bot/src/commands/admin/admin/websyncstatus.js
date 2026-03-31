const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getWebsiteSyncState, syncWebsiteStats } = require("../../../services/websiteSync");
const { createStyledEmbed } = require('../../utils/embedStyle');

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

    const snapshot = syncState.lastStats;
    const hasUsableSnapshot = Boolean(
      snapshot && (
        [snapshot.players, snapshot.factions, snapshot.countries].some((value) => Number.isFinite(Number(value))) ||
        (Array.isArray(snapshot.topPlayers) && snapshot.topPlayers.length > 0) ||
        (Array.isArray(snapshot.topFactions) && snapshot.topFactions.length > 0) ||
        (Array.isArray(snapshot.topCountries) && snapshot.topCountries.length > 0)
      )
    );

    const healthy = !syncState.lastError && hasUsableSnapshot;
    const embed = createStyledEmbed({
      interaction,
      icon: '🛰️',
      title: 'Website Sync Status',
      theme: 'system',
      summary: healthy ? 'Sync service is healthy.' : 'Sync service has recent issues or empty data.',
      sections: [
        {
          label: 'Health',
          content: [
            `Current: ${healthy ? '✅ HEALTHY' : '⚠️ WARNING'}`,
            `Refresh: ${shouldRefresh ? 'MANUAL RUN EXECUTED' : 'AUTO MODE'}`,
          ].join('\n'),
        },
      ],
      color: healthy ? 'success' : 'warning',
      cta: shouldRefresh ? 'Manual refresh executed' : 'Use /websyncstatus refresh:true to force sync',
    })
      .addFields(
        {
          name: "⚙️ Configuration",
          value: [
            `Enabled: ${syncState.enabled ? "Yes" : "No"}`,
            `API Configured: ${syncState.apiConfigured ? "Yes" : "No"}`,
            `Local Script: ${syncState.localScriptPath ? "Found" : "Not found"}`,
            `Interval: ${syncState.intervalMinutes} minute(s)`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "🕒 Last Activity",
          value: [
            `Last Attempt: ${lastAttempt}`,
            `Last Success: ${lastSuccess}`,
            `Last Error: ${syncState.lastError || "None"}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "📦 Cached Snapshot",
          value: syncState.lastStats
            ? [
                `Source: **${syncState.lastStats.source || "unknown"}**`,
                `Players: ${syncState.lastStats.players ?? "N/A"}`,
                `Factions: ${syncState.lastStats.factions ?? "N/A"}`,
                `Countries: ${syncState.lastStats.countries ?? "N/A"}`,
                `Usable Data: ${hasUsableSnapshot ? "Yes" : "No"}`,
              ].join("\n")
            : "No cached data yet.",
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
