const { EmbedBuilder } = require("discord.js");
const { colorForStatus } = require("./statusColors");

function buildMatchHighlightEmbed(payload) {
  const brandIcon = "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Theatre Info", iconURL: brandIcon })
    .setTitle(`🔥 Group ${payload.group} Match Highlight`)
    .setColor(colorForStatus(payload.status))
    .setDescription(`> ${String(payload.matchHighlight)}`)
    .addFields(
      { name: "👤 Player", value: `\`\`\`\n${String(payload.player)}\n\`\`\``, inline: true },
      { name: "🚦 Status", value: `\`\`\`\n${String(payload.status)}\n\`\`\``, inline: true },
      { name: "🎯 Score", value: `\`\`\`\n${String(payload.score)}\n\`\`\``, inline: true }
    )
    .setFooter({ text: "Ascend Entrenched", iconURL: brandIcon })
    .setTimestamp();
}

module.exports = {
  buildMatchHighlightEmbed
};
