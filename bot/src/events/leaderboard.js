const { EmbedBuilder } = require("discord.js");
const { colorForStatus } = require("./statusColors");

function buildLeaderboardEmbed(payload) {
  return new EmbedBuilder()
    .setTitle(`Group ${payload.group} Update`)
    .setColor(colorForStatus(payload.status))
    .addFields(
      { name: "Player", value: String(payload.player), inline: true },
      { name: "Status", value: String(payload.status), inline: true },
      { name: "Score", value: String(payload.score), inline: true },
      { name: "Match Highlight", value: String(payload.matchHighlight) }
    )
    .setTimestamp();
}

module.exports = {
  buildLeaderboardEmbed
};
