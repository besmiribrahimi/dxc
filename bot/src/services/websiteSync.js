const DEFAULT_SITE_URL = process.env.WEBSITE_HOME_URL || "https://dxc-chi.vercel.app/";
const API_URL = process.env.WEBSITE_API_URL || "";
const API_TOKEN = process.env.WEBSITE_API_TOKEN || "";
const SYNC_ENABLED = String(process.env.WEBSITE_SYNC_ENABLED || "true").toLowerCase() !== "false";
const SYNC_INTERVAL_MINUTES = Number(process.env.WEBSITE_SYNC_INTERVAL_MINUTES || 5);
const REQUEST_TIMEOUT_MS = 10000;

const state = {
  enabled: SYNC_ENABLED,
  apiConfigured: Boolean(API_URL),
  apiUrl: API_URL || null,
  homeUrl: DEFAULT_SITE_URL,
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
    sourceUpdatedAt: source.updatedAt || input.updatedAt || null,
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

  return {
    stats: normalized,
    source: "api",
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
      sourceUpdatedAt: null,
    },
    source: "homepage",
  };
}

async function syncWebsiteStats() {
  state.lastAttemptAt = Date.now();

  try {
    const result = (await fetchFromApi()) || (await fetchFromHomepage());

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
