const { EmbedBuilder } = require("discord.js");
const { STATUS_COLORS } = require("./statusColors");

function buildSubstitutionEmbed(payload) {
  return new EmbedBuilder()
    .setTitle(`Group ${payload.group} Substitution`)
    .setColor(STATUS_COLORS.info)
    .addFields(
      { name: "Player Out", value: String(payload.playerOut), inline: true },
      { name: "Player In", value: String(payload.playerIn), inline: true },
      { name: "Reason", value: String(payload.reason || "Tactical change") }
    )
    .setTimestamp();
}

module.exports = {
  buildSubstitutionEmbed
};
