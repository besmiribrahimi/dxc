const { SlashCommandBuilder } = require('discord.js');
const { syncWebsiteStats, getWebsiteSyncState } = require('../../../services/websiteSync');
const { createStyledEmbed, makeProgressBar } = require('../../utils/embedStyle');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webstats')
    .setDescription('Show live stats from the DXC website'),

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
      const topFaction = snapshot?.topFactions?.[0];
      const topCountry = snapshot?.topCountries?.[0];
      const maxTotal = Math.max(
        1,
        Number(snapshot?.players || 0),
        Number(snapshot?.factions || 0),
        Number(snapshot?.countries || 0)
      );
      const sourceUpdatedAt = snapshot?.sourceUpdatedAt
        ? `<t:${Math.floor(new Date(snapshot.sourceUpdatedAt).getTime() / 1000)}:R>`
        : 'N/A';

      if (!snapshot) {
        throw new Error(syncResult.error || 'No stats data available yet');
      }

      const embed = createStyledEmbed({
        interaction,
        icon: '📡',
        title: 'Live Stats',
        theme: 'leaderboard',
        summary: 'Real-time website metrics for competitive tracking.',
        sections: [
          {
            label: 'Signal Feed',
            content: `Source: **${snapshot.source || 'unknown'}**\nUpdated: **${sourceUpdatedAt}**\nMode: **${syncResult.ok ? 'LIVE' : 'CACHED'}**`,
          },
          {
            label: 'Population Pulse',
            content: [
              `Players   ${makeProgressBar(snapshot.players || 0, maxTotal, 10)}  ${snapshot.players ?? 'N/A'}`,
              `Factions  ${makeProgressBar(snapshot.factions || 0, maxTotal, 10)}  ${snapshot.factions ?? 'N/A'}`,
              `Countries ${makeProgressBar(snapshot.countries || 0, maxTotal, 10)}  ${snapshot.countries ?? 'N/A'}`,
            ].join('\n'),
          },
        ],
        cta: 'Run /webleaderboard for full standings',
      })
        .addFields(
          { name: '🧱 Top Faction', value: topFaction ? `**${topFaction.name}**\n${topFaction.count} players` : 'N/A', inline: true },
          { name: '🌍 Top Country', value: topCountry ? `**${topCountry.name}**\n${topCountry.count} players` : 'N/A', inline: true },
          { name: '⚡ Sync Status', value: syncResult.ok ? '**ONLINE**' : '**CACHED**', inline: true }
        )
        .setFooter({ text: syncResult.ok ? 'Sync successful' : 'Using cached snapshot' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = createStyledEmbed({
        interaction,
        icon: '⚠️',
        title: 'Stats Unavailable',
        theme: 'leaderboard',
        description: 'Could not fetch website data right now. Try again in a moment.',
        color: 'danger',
      })
        .addFields({ name: 'Error', value: String(error.message || error), inline: false })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
