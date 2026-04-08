function normalizeBaseUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "");
}

function ensureLeaderboardPath(pathname) {
  const rawPath = String(pathname || "");
  const cleaned = rawPath.replace(/\/+$/, "") || "/";

  if (cleaned === "/api/leaderboard-config") {
    return cleaned;
  }

  if (cleaned.endsWith("/api/leaderboard-config")) {
    return cleaned;
  }

  if (cleaned === "/api" || cleaned.endsWith("/api")) {
    return `${cleaned}/leaderboard-config`;
  }

  if (cleaned === "/") {
    return "/api/leaderboard-config";
  }

  return `${cleaned}/api/leaderboard-config`;
}

function resolveLeaderboardEndpoint(input) {
  const raw = normalizeBaseUrl(input);
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    url.pathname = ensureLeaderboardPath(url.pathname);
    return url.toString().replace(/\/+$/, "");
  } catch {
    if (raw.endsWith("/api/leaderboard-config")) {
      return raw;
    }

    if (raw.endsWith("/api")) {
      return `${raw}/leaderboard-config`;
    }

    return `${raw}/api/leaderboard-config`;
  }
}

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function clampKd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1.0;
  }

  return Math.max(0, Math.min(9.9, Number(numeric.toFixed(1))));
}

function normalizePlayers(rawPlayers) {
  const source = rawPlayers && typeof rawPlayers === "object" ? rawPlayers : {};
  const normalized = {};

  Object.entries(source).forEach(([rawName, rawStats]) => {
    const key = String(rawName || "").trim().toLowerCase();
    if (!key) {
      return;
    }

    const stats = rawStats && typeof rawStats === "object" ? rawStats : {};
    normalized[key] = {
      name: String(rawName || "").trim(),
      level: clampLevel(stats.level),
      kd: clampKd(stats.kd),
      totalMatches: Number.isFinite(Number(stats.totalMatches)) ? Number(stats.totalMatches) : 0,
      status: String(stats.status || "").trim().toLowerCase()
    };
  });

  return normalized;
}

function normalizeOrder(rawOrder, validKeys) {
  const keys = Array.isArray(validKeys) ? validKeys : [];
  const valid = new Set(keys);
  const seen = new Set();
  const ordered = [];

  if (Array.isArray(rawOrder)) {
    rawOrder.forEach((rawKey) => {
      const key = String(rawKey || "").trim().toLowerCase();
      if (!key || !valid.has(key) || seen.has(key)) {
        return;
      }

      seen.add(key);
      ordered.push(key);
    });
  }

  keys.forEach((key) => {
    if (!seen.has(key)) {
      ordered.push(key);
    }
  });

  return ordered;
}

function normalizeStatus(rawStatus, rank) {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status === "winner" || status === "active" || status === "eliminated") {
    return status;
  }

  if (rank <= 3) {
    return "winner";
  }

  return "active";
}

function rankPlayers(config) {
  const players = normalizePlayers(config?.players);
  const keys = Object.keys(players);
  if (!keys.length) {
    return [];
  }

  const order = normalizeOrder(config?.order, keys);
  const orderMap = new Map(order.map((key, index) => [key, index]));

  return keys
    .sort((a, b) => {
      const aOrder = orderMap.has(a) ? orderMap.get(a) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(b) ? orderMap.get(b) : Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aStats = players[a];
      const bStats = players[b];

      if (bStats.level !== aStats.level) {
        return bStats.level - aStats.level;
      }

      return a.localeCompare(b);
    })
    .map((key, index) => {
      const rank = index + 1;
      const stats = players[key];
      return {
        key,
        player: stats.name || key,
        rank,
        level: stats.level,
        kd: stats.kd,
        totalMatches: stats.totalMatches,
        status: normalizeStatus(stats.status, rank)
      };
    });
}

async function fetchLeaderboardData(endpointOrBaseUrl) {
  const endpoint = resolveLeaderboardEndpoint(endpointOrBaseUrl);
  if (!endpoint) {
    throw new Error("Leaderboard endpoint is not configured");
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Leaderboard API failed with HTTP ${response.status} at ${endpoint}`);
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.config || typeof payload.config !== "object") {
    throw new Error("Leaderboard API returned an invalid payload");
  }

  return {
    endpoint,
    updatedAt: payload?.config?.updatedAt || null,
    entries: rankPlayers(payload.config)
  };
}

function findEntryByRoblox(entries, robloxUsername) {
  const safeName = String(robloxUsername || "").trim().toLowerCase();
  if (!safeName) {
    return null;
  }

  const list = Array.isArray(entries) ? entries : [];
  return list.find((entry) => String(entry.player || "").trim().toLowerCase() === safeName) || null;
}

module.exports = {
  resolveLeaderboardEndpoint,
  fetchLeaderboardData,
  findEntryByRoblox
};
