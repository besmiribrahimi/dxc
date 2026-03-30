const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getWebsiteSyncState } = require('../../../services/websiteSync');
const { createStyledEmbed, makeProgressBar } = require('../../utils/embedStyle');

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botstatus')
    .setDescription('Show bot runtime and sync status')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sync = getWebsiteSyncState();
    const memory = process.memoryUsage();
    const uptimeText = formatDuration(process.uptime() * 1000);
    const pingMs = Math.round(interaction.client.ws.ping || 0);
    const heapUsageRatio = memory.heapTotal > 0 ? memory.heapUsed / memory.heapTotal : 0;
    const pingRatio = Math.min(1, pingMs / 250);

    const embed = createStyledEmbed({
      interaction,
      icon: '🛡️',
      title: 'Bot Status',
      theme: 'system',
      summary: 'Live runtime telemetry and sync health.',
      sections: [
        {
          label: 'Pulse',
          content: [
            `Latency  ${makeProgressBar(1 - pingRatio, 1, 10)}  ${pingMs} ms`,
            `Heap     ${makeProgressBar(heapUsageRatio, 1, 10)}  ${Math.round(heapUsageRatio * 100)}%`,
          ].join('\n'),
        },
      ],
      color: sync.lastError ? 'warning' : 'success',
      cta: sync.lastError ? 'Run /websyncstatus refresh:true to check sync recovery' : 'All systems nominal',
    })
      .addFields(
        {
          name: '⚙️ Runtime',
          value: [
            `Uptime: ${uptimeText}`,
            `Ping: ${pingMs} ms`,
            `Guilds: ${interaction.client.guilds.cache.size}`,
            `Profile: ${String(process.env.COMMAND_PROFILE || 'leaderboard').toLowerCase()}`,
            `PID: ${process.pid}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🧠 Memory',
          value: [
            `RSS: ${Math.round(memory.rss / (1024 * 1024))} MB`,
            `Heap Used: ${Math.round(memory.heapUsed / (1024 * 1024))} MB`,
            `Heap Total: ${Math.round(memory.heapTotal / (1024 * 1024))} MB`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🌐 Website Sync',
          value: [
            `Status: ${sync.lastError ? '⚠️ DEGRADED' : '✅ HEALTHY'}`,
            `Enabled: ${sync.enabled ? 'Yes' : 'No'}`,
            `Last Success: ${sync.lastSuccessAt ? `<t:${Math.floor(sync.lastSuccessAt / 1000)}:R>` : 'Never'}`,
            `Last Error: ${sync.lastError || 'None'}`,
            `Source: ${sync.lastStats?.source || 'N/A'}`,
          ].join('\n'),
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
