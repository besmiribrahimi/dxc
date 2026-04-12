const { EmbedBuilder } = require("discord.js");
const { STATUS_COLORS } = require("./statusColors");

function buildSubstitutionEmbed(payload) {
  const brandIcon = "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Match Control", iconURL: brandIcon })
    .setTitle(`🔄 Group ${payload.group} Substitution`)
    .setColor(STATUS_COLORS.info)
    .addFields(
      { name: "🔴 Player Out", value: `\`\`\`\n${String(payload.playerOut)}\n\`\`\``, inline: true },
      { name: "🟢 Player In", value: `\`\`\`\n${String(payload.playerIn)}\n\`\`\``, inline: true },
      { name: "📝 Reason", value: `> ${String(payload.reason || "Tactical change")}`, inline: false }
    )
    .setFooter({ text: "Ascend Entrenched", iconURL: brandIcon })
    .setTimestamp();
}

module.exports = {
  buildSubstitutionEmbed
};
