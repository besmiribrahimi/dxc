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
    extraPlayers: [],
    transfers: [],
    matches: [],
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

function normalizeMatches(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .slice(0, 300)
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const title = String(item.title || "").trim().slice(0, 120);
      const teamA = String(item.teamA || "").trim().toUpperCase();
      const teamB = String(item.teamB || "").trim().toUpperCase();

      if (!title || !teamA || !teamB) {
        return null;
      }

      return {
        id: String(item.id || `match-${Date.now()}-${index}`).trim(),
        type: String(item.type || "finished").trim().toLowerCase() === "upcoming" ? "upcoming" : "finished",
        title,
        teamA,
        teamB,
        scoreA: Number(item.scoreA) || 0,
        scoreB: Number(item.scoreB) || 0,
        casualtiesA: Number(item.casualtiesA) || 0,
        casualtiesB: Number(item.casualtiesB) || 0,
        status: String(item.status || "").trim(),
        date: String(item.date || new Date().toISOString().split('T')[0]).trim(),
        mediaUrl: String(item.mediaUrl || "").trim()
      };
    })
    .filter(Boolean);
}

function normalizeDeviceValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pc" || normalized === "desktop") {
    return "PC";
  }

  if (normalized === "mobile" || normalized === "phone" || normalized === "tablet") {
    return "Mobile";
  }

  if (normalized === "controller" || normalized === "console" || normalized === "gamepad") {
    return "Controller";
  }

  return "Unknown";
}

function normalizePlayerClassValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "engineer") {
    return "Engineer";
  }

  if (normalized === "officer") {
    return "Officer";
  }

  if (normalized === "recon") {
    return "Recon";
  }

  if (normalized === "rifleman") {
    return "Rifleman";
  }

  if (normalized === "skirmisher") {
    return "Skirmisher";
  }

  return "Unknown";
}

function normalizePlayerClassList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[\/,&|;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

  const normalized = [];
  source.forEach((entry) => {
    const role = normalizePlayerClassValue(entry);
    if (role === "Unknown" || normalized.includes(role)) {
      return;
    }

    normalized.push(role);
  });

  return normalized.slice(0, 3);
}

function normalizeDiscordId(value) {
  const normalized = String(value || "").trim().replace(/[<@!>]/g, "");
  if (/^\d{8,}$/.test(normalized)) {
    return normalized;
  }

  return "";
}

function normalizeOptionalUserId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return /^\d{3,14}$/.test(normalized) ? normalized : "";
}

function normalizeUserIdInput(value) {
  const directId = normalizeOptionalUserId(value);
  if (directId) {
    return directId;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const pathMatch = raw.match(/\/users\/(\d{3,14})(?:\/|$|\?)/i);
  if (pathMatch?.[1]) {
    return normalizeOptionalUserId(pathMatch[1]);
  }

  const queryMatch = raw.match(/[?&]userId=(\d{3,14})(?:&|$)/i);
  if (queryMatch?.[1]) {
    return normalizeOptionalUserId(queryMatch[1]);
  }

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    const parsedPathMatch = parsed.pathname.match(/\/users\/(\d{3,14})(?:\/|$)/i);
    if (parsedPathMatch?.[1]) {
      return normalizeOptionalUserId(parsedPathMatch[1]);
    }

    const parsedQueryId = parsed.searchParams.get("userId");
    if (parsedQueryId) {
      return normalizeOptionalUserId(parsedQueryId);
    }
  } catch {
    return "";
  }

  return "";
}

function normalizeExtraPlayers(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .slice(0, 120)
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const name = String(item.name || item.playerName || "").trim();
      if (!name) {
        return null;
      }

      return {
        id: String(item.id || `extra-player-${Date.now()}-${index}`).trim(),
        name,
        faction: String(item.faction || "N/A").trim().toUpperCase() || "N/A",
        class: normalizePlayerClassValue(item.class),
        classes: normalizePlayerClassList(item.classes ?? item.class),
        country: String(item.country || "N/A").trim() || "N/A",
        discordId: normalizeDiscordId(item.discordId),
        userId: normalizeUserIdInput(item.userId),
        device: normalizeDeviceValue(item.device)
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

    parsed.extraPlayers = normalizeExtraPlayers(parsed.extraPlayers);

    parsed.matches = normalizeMatches(parsed.matches || parsed.clips);

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
    extraPlayers: normalizeExtraPlayers(config?.extraPlayers),
    transfers: normalizeTransfers(config?.transfers),
    matches: normalizeMatches(config?.matches),
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
