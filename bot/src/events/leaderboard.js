const { EmbedBuilder } = require("discord.js");
const { colorForStatus } = require("./statusColors");

function buildLeaderboardEmbed(payload) {
  const brandIcon = "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Ranking Network", iconURL: brandIcon })
    .setTitle(`📊 Group ${payload.group} Leaderboard Update`)
    .setColor(colorForStatus(payload.status))
    .addFields(
      { name: "👤 Player", value: `\`\`\`\n${String(payload.player)}\n\`\`\``, inline: true },
      { name: "🎯 Score", value: `\`\`\`\n${String(payload.score)}\n\`\`\``, inline: true },
      { name: "🚦 Status", value: `> ${String(payload.status)}`, inline: true },
      { name: "🌟 Match Highlight", value: `> ${String(payload.matchHighlight)}`, inline: false }
    )
    .setFooter({ text: "Ascend Entrenched", iconURL: brandIcon })
    .setTimestamp();
}

module.exports = {
  buildLeaderboardEmbed
};
