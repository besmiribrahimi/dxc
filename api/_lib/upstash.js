const CONFIG_KEY_DEFAULT = "draxar:leaderboard:config";

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getUpstashUrl() {
  return firstEnv([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_KV_REST_API_URL",
    "UPSTASH_REDIS_REST_KV_URL",
    "UPSTASH_REDIS_REST_REDIS_URL"
  ]);
}

function getUpstashToken() {
  return firstEnv([
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_READ_ONLY_TOKEN"
  ]);
}

function getConfigKey() {
  return firstEnv(["LEADERBOARD_CONFIG_KEY"]) || CONFIG_KEY_DEFAULT;
}

function buildDefaultConfig() {
  return {
    version: 1,
    updatedAt: null,
    players: {},
    order: [],
    botSettings: {
      applicationsPanelChannelId: "",
      applicationsChannelId: "",
      notificationUserIds: []
    }
  };
}

function normalizeDiscordIds(raw) {
  const values = Array.isArray(raw)
    ? raw
    : String(raw || "")
      .split(/[\s,|;]+/)
      .filter(Boolean);

  return [...new Set(values.map((value) => String(value || "").trim()).filter((value) => /^\d{8,}$/.test(value)))];
}

function normalizeBotSettings(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  return {
    applicationsPanelChannelId: String(input.applicationsPanelChannelId || "").trim(),
    applicationsChannelId: String(input.applicationsChannelId || "").trim(),
    notificationUserIds: normalizeDiscordIds(input.notificationUserIds)
  };
}

async function runCommand(command) {
  const url = getUpstashUrl();
  const token = getUpstashToken();

  if (!url || !token) {
    throw new Error("Missing Upstash env vars. Set REST URL and REST TOKEN in Vercel.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  return payload;
}

async function getLeaderboardConfig() {
  const key = getConfigKey();
  const payload = await runCommand(["GET", key]);
  const raw = payload?.result;

  if (!raw || typeof raw !== "string") {
    return buildDefaultConfig();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return buildDefaultConfig();
    }

    if (!parsed.players || typeof parsed.players !== "object") {
      parsed.players = {};
    }

    if (!("version" in parsed)) {
      parsed.version = 1;
    }

    if (!("updatedAt" in parsed)) {
      parsed.updatedAt = null;
    }

    if (!Array.isArray(parsed.order)) {
      parsed.order = [];
    }

    parsed.botSettings = normalizeBotSettings(parsed.botSettings);

    return parsed;
  } catch {
    return buildDefaultConfig();
  }
}

async function saveLeaderboardConfig(config) {
  const key = getConfigKey();
  const safe = {
    version: Number(config?.version) || 1,
    updatedAt: String(config?.updatedAt || new Date().toISOString()),
    players: config?.players && typeof config.players === "object" ? config.players : {},
    order: Array.isArray(config?.order) ? config.order.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean) : [],
    botSettings: normalizeBotSettings(config?.botSettings)
  };

  await runCommand(["SET", key, JSON.stringify(safe)]);
  return safe;
}

module.exports = {
  buildDefaultConfig,
  getLeaderboardConfig,
  saveLeaderboardConfig
};
