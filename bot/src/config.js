const dotenv = require("dotenv");
const { loadRuntimeSettings } = require("./runtimeSettings");

dotenv.config();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function firstEnv(names, fallback = "") {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) {
      return value;
    }
  }

  return fallback;
}

function toPositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeBaseUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "");
}

function resolveLeaderboardApiUrl() {
  const direct = firstEnv([
    "LEADERBOARD_API_URL",
    "WEBSITE_API_URL",
    "WEBSITE_API-URL"
  ]);
  if (direct) {
    return direct;
  }

  const websiteHome = normalizeBaseUrl(firstEnv([
    "WEBSITE_HOME_URL",
    "WEBSITE_HOME-URL"
  ]));

  if (!websiteHome) {
    return "";
  }

  return `${websiteHome}/api/leaderboard-config`;
}

const discordToken = firstEnv(["DISCORD_BOT_TOKEN", "DISCORD_TOKEN"]);
if (!discordToken) {
  throw new Error("Missing required environment variable: DISCORD_BOT_TOKEN (or DISCORD_TOKEN)");
}

const discordChannelId = firstEnv(["DISCORD_CHANNEL_ID", "CHANNEL_ID"]);
if (!discordChannelId) {
  throw new Error("Missing required environment variable: DISCORD_CHANNEL_ID (or CHANNEL_ID)");
}

const runtimeSettings = loadRuntimeSettings();

module.exports = {
  discordToken,
  discordChannelId,
  discordGuildId: firstEnv(["DISCORD_GUILD_ID", "GUILD_ID"]),
  leaderboardApiUrl: resolveLeaderboardApiUrl(),
  leaderboardChannelId: firstEnv(["LEADERBOARD_CHANNEL_ID"]),
  ticketEnabled: !["false", "0", "off", "no"].includes(String(process.env.TICKET_ENABLED || "").trim().toLowerCase()),
  defaultTicketCategoryId: firstEnv(["TICKET_CATEGORY_ID"]),
  defaultTicketLogChannelId: firstEnv(["TICKET_LOG_CHANNEL_ID"]),
  defaultTicketPingRoleIds: firstEnv(["TICKET_PING_ROLE_IDS"]),
  defaultTicketReviewerRoleIds: firstEnv(["TICKET_REVIEWER_ROLE_IDS"]),
  defaultTicketAllowedRoleIds: firstEnv(["TICKET_ALLOWED_ROLE_IDS"]),
  brandingFooter: firstEnv(["BRANDING_FOOTER"], "Ascend Entrenched"),
  embedInfoColor: firstEnv(["EMBED_INFO_COLOR"], "#C8A2C8"),
  embedWinnerColor: firstEnv(["EMBED_WINNER_COLOR"], "#FFD700"),
  embedActiveColor: firstEnv(["EMBED_ACTIVE_COLOR"], "#C8A2C8"),
  embedEliminatedColor: firstEnv(["EMBED_ELIMINATED_COLOR"], "#9B59B6"),
  embedHighlightColor: firstEnv(["EMBED_HIGHLIGHT_COLOR"], "#FFECB3"),
  applicationsChannelId: String(runtimeSettings.applicationsChannelId || "").trim()
    || firstEnv(["APPLICATIONS_CHANNEL_ID", "APPLY_CHANNEL_ID"]),
  applicationsReviewerRoleId: String(runtimeSettings.applicationsReviewerRoleId || "").trim()
    || firstEnv(["APPLICATIONS_REVIEWER_ROLE_ID"]),
  applicationsAcceptedRoleId: String(runtimeSettings.applicationsAcceptedRoleId || "").trim()
    || firstEnv(["APPLICATIONS_ACCEPTED_ROLE_ID"]),
  applicationCooldownMs: toPositiveInt(runtimeSettings.applicationCooldownMs, toPositiveInt(process.env.APPLICATION_COOLDOWN_MS, 120000)),
  port: toPositiveInt(process.env.PORT, 3001),
  webhookSharedSecret: String(process.env.WEBHOOK_SHARED_SECRET || "").trim(),
  queueIntervalMs: toPositiveInt(process.env.QUEUE_INTERVAL_MS, 1200),
  maxQueueSize: toPositiveInt(process.env.MAX_QUEUE_SIZE, 200)
};
