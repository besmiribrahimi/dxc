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
    transfers: [],
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

function normalizeTransferStatus(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "official" || value === "agreed") {
    return value;
  }

  return "rumor";
}

function normalizeTransferDate(raw) {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return "";
}

function normalizeTransfers(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .slice(0, 120)
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const playerName = String(item.playerName || "").trim();
      const fromFaction = String(item.fromFaction || "").trim().toUpperCase();
      const toFaction = String(item.toFaction || "").trim().toUpperCase();

      if (!playerName || !fromFaction || !toFaction) {
        return null;
      }

      return {
        id: String(item.id || `transfer-${Date.now()}-${index}`).trim(),
        playerName,
        fromFaction,
        toFaction,
        fee: String(item.fee || "").trim(),
        transferDate: normalizeTransferDate(item.transferDate),
        status: normalizeTransferStatus(item.status),
        note: String(item.note || "").trim().slice(0, 240)
      };
    })
    .filter(Boolean);
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

    parsed.transfers = normalizeTransfers(parsed.transfers);

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
    transfers: normalizeTransfers(config?.transfers),
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
