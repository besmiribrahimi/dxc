const { SlashCommandBuilder } = require("discord.js");
const { syncWebsiteStats, getWebsiteSyncState } = require("../../../services/websiteSync");
const { createStyledEmbed, getPlacementBadge } = require('../../utils/embedStyle');

function formatTopPlayers(topPlayers) {
  if (!Array.isArray(topPlayers) || topPlayers.length === 0) {
    return "No player leaderboard data available from current source.";
  }

  return topPlayers
    .slice(0, 10)
    .map(
      (player, index) =>
        `${getPlacementBadge(index)} **${player.username || "N/A"}**\n${player.faction || "N/A"} • ${player.country || "N/A"}`
    )
    .join("\n");
}

function formatTopCounts(label, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `No ${label.toLowerCase()} ranking data available.`;
  }

  return rows
    .slice(0, 5)
    .map((row, index) => `${getPlacementBadge(index)} ${row.name || "N/A"} (${row.count || 0})`)
    .join("\n");
}

function hasUsableSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const hasNumericCounts = [snapshot.players, snapshot.factions, snapshot.countries]
    .some((value) => Number.isFinite(Number(value)));

  const hasLeaderboardRows =
    (Array.isArray(snapshot.topPlayers) && snapshot.topPlayers.length > 0) ||
    (Array.isArray(snapshot.topFactions) && snapshot.topFactions.length > 0) ||
    (Array.isArray(snapshot.topCountries) && snapshot.topCountries.length > 0);

  return hasNumericCounts || hasLeaderboardRows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("webleaderboard")
    .setDescription("Show website top players, factions, and countries"),

  async execute(interaction) {
    try {
      await interaction.deferReply();
    } catch (error) {
      if (error?.code === 10062) {
        return;
      }

      throw error;
    }

    try {
      const syncResult = await syncWebsiteStats();
      const snapshot = syncResult.stats || getWebsiteSyncState().lastStats;

      if (!snapshot) {
        throw new Error(syncResult.error || "No leaderboard data available yet");
      }

      if (!hasUsableSnapshot(snapshot)) {
        throw new Error(syncResult.error || "Website sync returned empty leaderboard data");
      }

      const embed = createStyledEmbed({
        interaction,
        icon: '🏆',
        title: 'Website Leaderboard',
        theme: 'leaderboard',
        summary: 'Top competitive standings synced from the main platform.',
        sections: [
          {
            label: 'Top 10 Players',
            content: formatTopPlayers(snapshot.topPlayers),
          },
        ],
        cta: 'Use /webstats for live totals and source health',
      })
        .addFields(
          {
            name: "⚔️ Top Factions",
            value: formatTopCounts("Faction", snapshot.topFactions),
            inline: true,
          },
          {
            name: "🌍 Top Countries",
            value: formatTopCounts("Country", snapshot.topCountries),
            inline: true,
          },
          {
            name: "📡 Overview",
            value: [
              `Players: **${snapshot.players ?? "N/A"}**`,
              `Factions: **${snapshot.factions ?? "N/A"}**`,
              `Countries: **${snapshot.countries ?? "N/A"}**`,
              `Source: **${snapshot.source || "unknown"}**`,
            ].join("\n"),
            inline: false,
          }
        )
        .setFooter({ text: syncResult.ok ? "Sync successful" : "Using cached snapshot" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = createStyledEmbed({
        interaction,
        icon: '🚫',
        title: 'Leaderboard Unavailable',
        theme: 'leaderboard',
        description: 'Could not fetch leaderboard data right now. Try again shortly.',
        color: 'danger',
      })
        .addFields({ name: "Error", value: String(error.message || error), inline: false })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
