const fs = require("fs");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");

const SETTINGS_FILE_PATH = path.resolve(__dirname, "..", "..", "guild-settings.json");

const DEFAULT_COLORS = {
  info: "#C8A2C8",
  winner: "#FFD700",
  active: "#C8A2C8",
  eliminated: "#9B59B6",
  highlight: "#FFECB3"
};

function toPositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(raw)) {
    return raw;
  }

  return fallback;
}

function splitCsvIds(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function defaultGuildSettings(config) {
  const defaultPingRoles = uniqueIds([
    ...splitCsvIds(config.defaultTicketPingRoleIds),
    config.applicationsReviewerRoleId,
    config.applicationsAcceptedRoleId
  ]);

  const defaultReviewerRoles = uniqueIds([
    ...splitCsvIds(config.defaultTicketReviewerRoleIds),
    ...defaultPingRoles
  ]);

  return {
    ticketEnabled: typeof config.ticketEnabled === "boolean" ? config.ticketEnabled : true,
    ticketCategoryId: String(config.defaultTicketCategoryId || "").trim(),
    ticketLogChannelId: String(config.defaultTicketLogChannelId || "").trim(),
    ticketPingRoleIds: defaultPingRoles,
    ticketReviewerRoleIds: defaultReviewerRoles,
    ticketAllowedRoleIds: uniqueIds(splitCsvIds(config.defaultTicketAllowedRoleIds)),
    leaderboardChannelId: String(config.leaderboardChannelId || config.discordChannelId || "").trim(),
    leaderboardEndpoint: String(config.leaderboardApiUrl || "").trim(),
    leaderboardAutoPostEnabled: Boolean(config.leaderboardAutoPostEnabled),
    leaderboardAutoPostIntervalHours: toPositiveInt(config.leaderboardAutoPostIntervalHours, 6),
    leaderboardAutoPostLastRunAt: "",
    highlightEnabled: true,
    brandingFooter: String(config.brandingFooter || "Ascend Entrenched").trim() || "Ascend Entrenched",
    colors: {
      info: normalizeHexColor(config.embedInfoColor, DEFAULT_COLORS.info),
      winner: normalizeHexColor(config.embedWinnerColor, DEFAULT_COLORS.winner),
      active: normalizeHexColor(config.embedActiveColor, DEFAULT_COLORS.active),
      eliminated: normalizeHexColor(config.embedEliminatedColor, DEFAULT_COLORS.eliminated),
      highlight: normalizeHexColor(config.embedHighlightColor, DEFAULT_COLORS.highlight)
    },
    applicationCooldownMs: toPositiveInt(config.applicationCooldownMs, 120000)
  };
}

function sanitizeGuildSettings(raw, defaults) {
  const input = raw && typeof raw === "object" ? raw : {};

  return {
    ticketEnabled: typeof input.ticketEnabled === "boolean" ? input.ticketEnabled : defaults.ticketEnabled,
    ticketCategoryId: String(input.ticketCategoryId || defaults.ticketCategoryId || "").trim(),
    ticketLogChannelId: String(input.ticketLogChannelId || defaults.ticketLogChannelId || "").trim(),
    ticketPingRoleIds: uniqueIds(input.ticketPingRoleIds || defaults.ticketPingRoleIds),
    ticketReviewerRoleIds: uniqueIds(input.ticketReviewerRoleIds || defaults.ticketReviewerRoleIds),
    ticketAllowedRoleIds: uniqueIds(input.ticketAllowedRoleIds || defaults.ticketAllowedRoleIds),
    leaderboardChannelId: String(input.leaderboardChannelId || defaults.leaderboardChannelId || "").trim(),
    leaderboardEndpoint: String(input.leaderboardEndpoint || defaults.leaderboardEndpoint || "").trim(),
    leaderboardAutoPostEnabled: typeof input.leaderboardAutoPostEnabled === "boolean"
      ? input.leaderboardAutoPostEnabled
      : defaults.leaderboardAutoPostEnabled,
    leaderboardAutoPostIntervalHours: Math.max(1, Math.min(168, toPositiveInt(input.leaderboardAutoPostIntervalHours, defaults.leaderboardAutoPostIntervalHours))),
    leaderboardAutoPostLastRunAt: normalizeIsoDate(input.leaderboardAutoPostLastRunAt),
    highlightEnabled: typeof input.highlightEnabled === "boolean" ? input.highlightEnabled : defaults.highlightEnabled,
    brandingFooter: String(input.brandingFooter || defaults.brandingFooter || "Ascend Entrenched").trim() || "Ascend Entrenched",
    colors: {
      info: normalizeHexColor(input?.colors?.info, defaults.colors.info),
      winner: normalizeHexColor(input?.colors?.winner, defaults.colors.winner),
      active: normalizeHexColor(input?.colors?.active, defaults.colors.active),
      eliminated: normalizeHexColor(input?.colors?.eliminated, defaults.colors.eliminated),
      highlight: normalizeHexColor(input?.colors?.highlight, defaults.colors.highlight)
    },
    applicationCooldownMs: toPositiveInt(input.applicationCooldownMs, defaults.applicationCooldownMs)
  };
}

function loadAllSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(SETTINGS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllSettings(allSettings) {
  fs.writeFileSync(SETTINGS_FILE_PATH, `${JSON.stringify(allSettings, null, 2)}\n`, "utf8");
}

function getGuildSettings(guildId, config) {
  const safeGuildId = String(guildId || "").trim();
  if (!safeGuildId) {
    return defaultGuildSettings(config);
  }

  const defaults = defaultGuildSettings(config);
  const allSettings = loadAllSettings();
  return sanitizeGuildSettings(allSettings[safeGuildId], defaults);
}

function patchGuildSettings(guildId, patch, config) {
  const safeGuildId = String(guildId || "").trim();
  if (!safeGuildId) {
    throw new Error("guildId is required to patch guild settings");
  }

  const allSettings = loadAllSettings();
  const defaults = defaultGuildSettings(config);
  const current = sanitizeGuildSettings(allSettings[safeGuildId], defaults);

  const nextRaw = {
    ...current,
    ...(patch && typeof patch === "object" ? patch : {}),
    colors: {
      ...current.colors,
      ...(patch?.colors && typeof patch.colors === "object" ? patch.colors : {})
    }
  };

  const next = sanitizeGuildSettings(nextRaw, defaults);
  allSettings[safeGuildId] = next;
  saveAllSettings(allSettings);
  return next;
}

function updateAllowedRole(guildId, roleId, action, config) {
  const safeAction = String(action || "").trim().toLowerCase();
  const safeRoleId = String(roleId || "").trim();

  const current = getGuildSettings(guildId, config);
  const nextRoles = [...current.ticketAllowedRoleIds];

  if (safeAction === "clear") {
    return patchGuildSettings(guildId, { ticketAllowedRoleIds: [] }, config);
  }

  if (!safeRoleId) {
    throw new Error("roleId is required for this action");
  }

  if (safeAction === "add") {
    if (!nextRoles.includes(safeRoleId)) {
      nextRoles.push(safeRoleId);
    }
  } else if (safeAction === "remove") {
    const index = nextRoles.indexOf(safeRoleId);
    if (index >= 0) {
      nextRoles.splice(index, 1);
    }
  } else {
    throw new Error("Invalid action");
  }

  return patchGuildSettings(guildId, { ticketAllowedRoleIds: nextRoles }, config);
}

function canCreateTicket(member, settings) {
  if (!member) {
    return false;
  }

  if (!settings.ticketEnabled) {
    return false;
  }

  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  if (!Array.isArray(settings.ticketAllowedRoleIds) || settings.ticketAllowedRoleIds.length === 0) {
    return true;
  }

  return settings.ticketAllowedRoleIds.some((roleId) => member.roles?.cache?.has(roleId));
}

module.exports = {
  SETTINGS_FILE_PATH,
  DEFAULT_COLORS,
  getGuildSettings,
  patchGuildSettings,
  updateAllowedRole,
  canCreateTicket,
  normalizeHexColor,
  splitCsvIds,
  toPositiveInt
};
