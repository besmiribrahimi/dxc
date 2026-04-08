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
  SUBSTITUTION: "substitution",
  NOTIFY: "notify",
  RUNTIME_SETTINGS: "runtime_settings"
};

function resolveEventType(payload) {
  const raw = String(payload?.eventType || "").trim().toLowerCase();

  if (raw === "highlight" || raw === "matchhighlight" || raw === "match_highlight") {
    return EVENT_TYPES.HIGHLIGHT;
  }

  if (raw === "substitution" || raw === "sub") {
    return EVENT_TYPES.SUBSTITUTION;
  }

  if (raw === "notify" || raw === "notification" || raw === "broadcast") {
    return EVENT_TYPES.NOTIFY;
  }

  if (raw === "runtime_settings" || raw === "runtime" || raw === "settings_sync") {
    return EVENT_TYPES.RUNTIME_SETTINGS;
  }

  // Backward-compatible default for existing web payloads.
  return EVENT_TYPES.LEADERBOARD;
}

function buildEventEmbed(payload, eventType) {
  if (eventType === EVENT_TYPES.NOTIFY) {
    return buildMatchHighlightEmbed({
      ...payload,
      player: "Ascend Entrenched",
      status: "info",
      score: 0,
      matchHighlight: String(payload?.message || "Notification event")
    });
  }

  if (eventType === EVENT_TYPES.RUNTIME_SETTINGS) {
    return buildMatchHighlightEmbed({
      ...payload,
      player: "Ascend Entrenched",
      status: "info",
      score: 0,
      matchHighlight: "Runtime settings synchronization received"
    });
  }

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
