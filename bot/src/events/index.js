const { buildLeaderboardEmbed } = require("./leaderboard");
const { buildMatchHighlightEmbed } = require("./matchHighlights");
const { buildSubstitutionEmbed } = require("./substitutions");

// Extension guide:
// 1) Add a new embed builder in src/events/<newEvent>.js
// 2) Add a new EVENT_TYPES constant below
// 3) Map incoming eventType values in resolveEventType
// 4) Route to the new builder in buildEventEmbed

const EVENT_TYPES = {
  LEADERBOARD: "leaderboard",
  HIGHLIGHT: "highlight",
  SUBSTITUTION: "substitution"
};

function resolveEventType(payload) {
  const raw = String(payload?.eventType || "").trim().toLowerCase();

  if (raw === "highlight" || raw === "matchhighlight" || raw === "match_highlight") {
    return EVENT_TYPES.HIGHLIGHT;
  }

  if (raw === "substitution" || raw === "sub") {
    return EVENT_TYPES.SUBSTITUTION;
  }

  // Backward-compatible default for existing web payloads.
  return EVENT_TYPES.LEADERBOARD;
}

function buildEventEmbed(payload, eventType) {
  if (eventType === EVENT_TYPES.HIGHLIGHT) {
    return buildMatchHighlightEmbed(payload);
  }

  if (eventType === EVENT_TYPES.SUBSTITUTION) {
    return buildSubstitutionEmbed(payload);
  }

  return buildLeaderboardEmbed(payload);
}

module.exports = {
  EVENT_TYPES,
  resolveEventType,
  buildEventEmbed
};
