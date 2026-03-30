const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { syncWebsiteStats, getWebsiteSyncState } = require('../../../services/websiteSync');

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

      if (!snapshot) {
        throw new Error(syncResult.error || 'No stats data available yet');
      }

      const embed = new EmbedBuilder()
        .setColor('#B00000')
        .setTitle('DXC Website Live Stats')
        .setDescription('Live values from website sync service.')
        .addFields(
          { name: 'Players', value: String(snapshot.players ?? 'N/A'), inline: true },
          { name: 'Factions', value: String(snapshot.factions ?? 'N/A'), inline: true },
          { name: 'Countries', value: String(snapshot.countries ?? 'N/A'), inline: true },
          { name: 'Source', value: snapshot.source || 'unknown', inline: true }
        )
        .setFooter({ text: syncResult.ok ? 'Sync successful' : 'Using cached snapshot' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('DXC Website Stats Unavailable')
        .setDescription('The bot could not fetch website data right now. Please try again.')
        .addFields({ name: 'Error', value: String(error.message || error), inline: false })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
