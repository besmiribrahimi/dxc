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

function splitCsvIds(raw) {
  return [...new Set(
    String(raw || "")
      .split(/[\s,|;]+/)
      .map((value) => value.trim())
      .filter((value) => /^\d{8,}$/.test(value))
  )];
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

function resolveWebsiteHomeUrl() {
  return normalizeBaseUrl(firstEnv([
    "WEBSITE_HOME_URL",
    "WEBSITE_HOME-URL"
  ]));
}

function resolveLfgQueueApiUrl() {
  const direct = firstEnv(["LFG_QUEUE_API_URL"]);
  if (direct) {
    return direct;
  }

  const websiteHome = resolveWebsiteHomeUrl();
  if (!websiteHome) {
    return "";
  }

  return `${websiteHome}/api/lfg-queue`;
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
  websiteHomeUrl: resolveWebsiteHomeUrl(),
  websiteApiToken: firstEnv(["WEBSITE_API_TOKEN", "ADMIN_PANEL_SECRET"]),
  lfgQueueApiUrl: resolveLfgQueueApiUrl(),
  leaderboardApiUrl: resolveLeaderboardApiUrl(),
  leaderboardChannelId: firstEnv(["LEADERBOARD_CHANNEL_ID"]),
  leaderboardAutoPostEnabled: ["true", "1", "on", "yes"].includes(String(process.env.LEADERBOARD_AUTO_POST_ENABLED || "").trim().toLowerCase()),
  leaderboardAutoPostIntervalHours: toPositiveInt(process.env.LEADERBOARD_AUTO_POST_INTERVAL_HOURS, 6),
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
  applicationsPanelChannelId: String(runtimeSettings.applicationsPanelChannelId || "").trim()
    || firstEnv(["APPLICATIONS_PANEL_CHANNEL_ID", "APPLY_PANEL_CHANNEL_ID"]),
  applicationsChannelId: String(runtimeSettings.applicationsChannelId || "").trim()
    || firstEnv(["APPLICATIONS_CHANNEL_ID", "APPLY_CHANNEL_ID"]),
  applicationsReviewerRoleId: String(runtimeSettings.applicationsReviewerRoleId || "").trim()
    || firstEnv(["APPLICATIONS_REVIEWER_ROLE_ID"]),
  applicationsAcceptedRoleId: String(runtimeSettings.applicationsAcceptedRoleId || "").trim()
    || firstEnv(["APPLICATIONS_ACCEPTED_ROLE_ID"]),
  notificationUserIds: Array.isArray(runtimeSettings.notificationUserIds) && runtimeSettings.notificationUserIds.length
    ? runtimeSettings.notificationUserIds
    : splitCsvIds(firstEnv(["NOTIFICATION_USER_IDS", "NOTIFY_USER_IDS"])),
  applicationCooldownMs: toPositiveInt(runtimeSettings.applicationCooldownMs, toPositiveInt(process.env.APPLICATION_COOLDOWN_MS, 120000)),
  port: toPositiveInt(process.env.PORT, 3001),
  webhookSharedSecret: String(process.env.WEBHOOK_SHARED_SECRET || "").trim(),
  queueIntervalMs: toPositiveInt(process.env.QUEUE_INTERVAL_MS, 1200),
  maxQueueSize: toPositiveInt(process.env.MAX_QUEUE_SIZE, 200)
};
