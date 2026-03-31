const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DEFAULT_SITE_URL = process.env.WEBSITE_HOME_URL || "https://dxc-chi.vercel.app/";
const API_URL = process.env.WEBSITE_API_URL || "";
const API_TOKEN = process.env.WEBSITE_API_TOKEN || "";
const LOCAL_SCRIPT_PATH = process.env.WEBSITE_LOCAL_SCRIPT_PATH || "";
const SYNC_ENABLED = String(process.env.WEBSITE_SYNC_ENABLED || "true").toLowerCase() !== "false";
const SYNC_INTERVAL_MINUTES = Number(process.env.WEBSITE_SYNC_INTERVAL_MINUTES || 5);
const REQUEST_TIMEOUT_MS = 10000;
const PLAYER_DATA_REGEX = /const\s+playerData\s*=\s*(\[[\s\S]*?\]);/;

function trimTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function getWebsiteBaseUrl() {
  if (API_URL) {
    try {
      return trimTrailingSlash(new URL(API_URL).origin);
    } catch {
      // Ignore parse errors and fall back to configured home URL.
    }
  }

  return trimTrailingSlash(DEFAULT_SITE_URL);
}

function resolveExistingLocalScript() {
  const candidates = [
    LOCAL_SCRIPT_PATH,
    path.resolve(process.cwd(), "..", "script.js"),
    path.resolve(process.cwd(), "..", "draxar", "script.js"),
    path.resolve(process.cwd(), "script.js"),
    path.resolve(__dirname, "..", "..", "..", "script.js"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const RESOLVED_LOCAL_SCRIPT = resolveExistingLocalScript();

const state = {
  enabled: SYNC_ENABLED,
  apiConfigured: Boolean(API_URL),
  apiUrl: API_URL || null,
  homeUrl: DEFAULT_SITE_URL,
  localScriptPath: RESOLVED_LOCAL_SCRIPT,
  intervalMinutes: Number.isFinite(SYNC_INTERVAL_MINUTES) && SYNC_INTERVAL_MINUTES > 0 ? SYNC_INTERVAL_MINUTES : 5,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastStats: null,
};

function parseMetric(html, label) {
  const pattern = new RegExp(`${label}\\s*(\\d+)`, "i");
  const match = html.match(pattern);
  return match ? Number(match[1]) : null;
}

function normalizeLabel(value) {
  const text = String(value || "").trim();
  return text || "N/A";
}

function normalizeTopPlayers(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(0, 10).map((player, index) => ({
    rank: Number.isFinite(Number(player?.rank)) ? Number(player.rank) : index + 1,
    username: normalizeLabel(player?.username),
    faction: normalizeLabel(player?.faction),
    country: normalizeLabel(player?.country),
    level: Number.isFinite(Number(player?.level)) ? Number(player.level) : null,
  }));
}

function normalizeTopCounts(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(0, 5).map((item) => ({
    name: normalizeLabel(item?.name),
    count: Number.isFinite(Number(item?.count)) ? Number(item.count) : 0,
  }));
}

function buildTopCounts(players, fieldName, limit = 5) {
  const counts = new Map();

  for (const player of players) {
    const key = normalizeLabel(player?.[fieldName]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function buildTopPlayers(players, limit = 10) {
  return players.slice(0, limit).map((player, index) => ({
    rank: index + 1,
    username: normalizeLabel(player?.username),
    faction: normalizeLabel(player?.faction),
    country: normalizeLabel(player?.country),
    level: Number.isFinite(Number(player?.level)) ? Number(player.level) : null,
  }));
}

function applyGlobalOrderToTopPlayers(stats, rankingState) {
  if (!stats || typeof stats !== "object") {
    return stats;
  }

  const order = Array.isArray(rankingState?.order)
    ? rankingState.order.map((name) => String(name || "").trim()).filter(Boolean)
    : [];

  if (!order.length) {
    return stats;
  }

  const levels = rankingState?.levels && typeof rankingState.levels === "object"
    ? rankingState.levels
    : {};

  const existing = Array.isArray(stats.topPlayers) ? stats.topPlayers : [];
  const byUsername = new Map(
    existing
      .map((player) => [String(player?.username || "").trim(), player])
      .filter(([username]) => Boolean(username))
  );

  const used = new Set();
  const reordered = [];

  for (const username of order) {
    if (used.has(username)) {
      continue;
    }

    const existingPlayer = byUsername.get(username);
    const level = Number.isFinite(Number(levels[username])) ? Number(levels[username]) : null;

    reordered.push(
      existingPlayer
        ? {
            ...existingPlayer,
            ...(existingPlayer.level == null && level != null ? { level } : {}),
          }
        : {
            username,
            faction: "N/A",
            country: "N/A",
            level,
          }
    );

    used.add(username);
  }

  for (const player of existing) {
    const username = String(player?.username || "").trim();
    if (!username || used.has(username)) {
      continue;
    }

    reordered.push(player);
    used.add(username);
  }

  return {
    ...stats,
    topPlayers: reordered.slice(0, 10).map((player, index) => ({
      ...player,
      rank: index + 1,
    })),
  };
}

function normalizeStats(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input.stats && typeof input.stats === "object" ? input.stats : input;

  const players = Number(source.players);
  const factions = Number(source.factions);
  const countries = Number(source.countries);

  return {
    players: Number.isFinite(players) ? players : null,
    factions: Number.isFinite(factions) ? factions : null,
    countries: Number.isFinite(countries) ? countries : null,
    topPlayers: normalizeTopPlayers(source.topPlayers),
    topFactions: normalizeTopCounts(source.topFactions),
    topCountries: normalizeTopCounts(source.topCountries),
    sourceUpdatedAt: source.updatedAt || input.updatedAt || null,
  };
}

function parseLocalPlayerData(scriptSource) {
  const match = scriptSource.match(PLAYER_DATA_REGEX);
  if (!match) {
    throw new Error("Could not find playerData array in local website script.js");
  }

  const parsed = vm.runInNewContext(`(${match[1]})`, {}, { timeout: 500 });
  if (!Array.isArray(parsed)) {
    throw new Error("playerData in local website script.js is not an array");
  }

  return parsed;
}

function computeStatsFromPlayers(players) {
  const factions = new Set(
    players
      .map((player) => String(player?.faction || "").trim())
      .filter(Boolean)
  );

  const countries = new Set(
    players
      .map((player) => String(player?.country || "").trim())
      .filter(Boolean)
  );

  return {
    players: players.length,
    factions: factions.size,
    countries: countries.size,
    topPlayers: buildTopPlayers(players, 10),
    topFactions: buildTopCounts(players, "faction", 5),
    topCountries: buildTopCounts(players, "country", 5),
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "DXC-Discord-Bot/1.0",
        ...(options.headers || {}),
      },
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromApi() {
  if (!API_URL) {
    return null;
  }

  const response = await fetchWithTimeout(API_URL, {
    headers: {
      ...(API_TOKEN ? { "x-bot-token": API_TOKEN } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const json = await response.json();
  const normalized = normalizeStats(json);

  if (!normalized) {
    throw new Error("API response is not in expected stats format");
  }

  const missingLeaderboardData =
    normalized.topPlayers.length === 0 ||
    normalized.topFactions.length === 0 ||
    normalized.topCountries.length === 0;

  if (missingLeaderboardData && RESOLVED_LOCAL_SCRIPT) {
    try {
      const local = await fetchFromLocalWebsiteScript();
      const localStats = local?.stats;

      if (localStats) {
        if (normalized.topPlayers.length === 0) {
          normalized.topPlayers = localStats.topPlayers || [];
        }

        if (normalized.topFactions.length === 0) {
          normalized.topFactions = localStats.topFactions || [];
        }

        if (normalized.topCountries.length === 0) {
          normalized.topCountries = localStats.topCountries || [];
        }
      }
    } catch {
      // Keep API stats even when local enrichment is unavailable.
    }
  }

  const rankingState = await fetchGlobalRankingOrder().catch(() => null);
  const syncedStats = applyGlobalOrderToTopPlayers(normalized, rankingState);

  return {
    stats: syncedStats,
    source: "api",
  };
}

async function fetchGlobalRankingOrder() {
  const baseUrl = getWebsiteBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const response = await fetchWithTimeout(`${baseUrl}/api/rankings/order`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!Array.isArray(payload?.order) || payload.order.length === 0) {
    return null;
  }

  return {
    order: payload.order,
    levels: payload.levels && typeof payload.levels === "object" ? payload.levels : {},
  };
}

async function fetchFromHomepage() {
  const response = await fetchWithTimeout(DEFAULT_SITE_URL);

  if (!response.ok) {
    throw new Error(`Homepage request failed with status ${response.status}`);
  }

  const html = await response.text();

  return {
    stats: {
      players: parseMetric(html, "PLAYERS"),
      factions: parseMetric(html, "FACTIONS"),
      countries: parseMetric(html, "COUNTRIES"),
      topPlayers: [],
      topFactions: [],
      topCountries: [],
      sourceUpdatedAt: null,
    },
    source: "homepage",
  };
}

async function fetchFromLocalWebsiteScript() {
  if (!RESOLVED_LOCAL_SCRIPT) {
    return null;
  }

  const source = await fs.promises.readFile(RESOLVED_LOCAL_SCRIPT, "utf8");
  const players = parseLocalPlayerData(source);
  const stats = computeStatsFromPlayers(players);
  const updatedAt = (await fs.promises.stat(RESOLVED_LOCAL_SCRIPT)).mtime.toISOString();

  return {
    stats: {
      ...stats,
      sourceUpdatedAt: updatedAt,
    },
    source: "local-script",
  };
}

async function syncWebsiteStats() {
  state.lastAttemptAt = Date.now();

  try {
    const attempts = [
      ["api", fetchFromApi],
      ["local-script", fetchFromLocalWebsiteScript],
      ["homepage", fetchFromHomepage],
    ];

    const errors = [];
    let result = null;

    for (const [sourceName, fetcher] of attempts) {
      try {
        const value = await fetcher();
        if (value) {
          result = value;
          break;
        }
      } catch (error) {
        errors.push(`${sourceName}: ${String(error?.message || error)}`);
      }
    }

    if (!result) {
      throw new Error(errors.length ? errors.join(" | ") : "No website sync source was available");
    }

    state.lastSuccessAt = Date.now();
    state.lastError = null;
    state.lastStats = {
      ...result.stats,
      source: result.source,
    };

    return {
      ok: true,
      stats: state.lastStats,
      fetchedAt: state.lastSuccessAt,
    };
  } catch (error) {
    state.lastError = String(error?.message || error);

    return {
      ok: false,
      error: state.lastError,
      stats: state.lastStats,
      fetchedAt: state.lastSuccessAt,
    };
  }
}

function getWebsiteSyncState() {
  return {
    ...state,
    lastStats: state.lastStats ? { ...state.lastStats } : null,
  };
}

function startWebsiteAutoSync(logger = console) {
  if (!state.enabled) {
    logger.log("Website sync disabled by WEBSITE_SYNC_ENABLED=false");
    return null;
  }

  const intervalMs = state.intervalMinutes * 60 * 1000;

  const run = async () => {
    const result = await syncWebsiteStats();

    if (result.ok) {
      logger.log(
        `Website sync ok (${state.lastStats.source}) players=${state.lastStats.players ?? "N/A"} factions=${state.lastStats.factions ?? "N/A"} countries=${state.lastStats.countries ?? "N/A"}`
      );
      return;
    }

    logger.warn(`Website sync failed: ${result.error}`);
  };

  run().catch(() => null);
  const timer = setInterval(() => {
    run().catch(() => null);
  }, intervalMs);

  return timer;
}

module.exports = {
  syncWebsiteStats,
  getWebsiteSyncState,
  startWebsiteAutoSync,
};
