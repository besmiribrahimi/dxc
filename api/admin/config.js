const { parseJsonBody, requireAdmin, sendJson } = require("../_lib/auth");
const { getLeaderboardConfig, saveLeaderboardConfig } = require("../_lib/upstash");

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
      level: clampLevel(stats.level),
      kd: clampKd(stats.kd)
    };
  });

  return normalized;
}

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (req.method === "GET") {
    try {
      const config = await getLeaderboardConfig();
      return sendJson(res, 200, { ok: true, config });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load config"
      });
    }
  }

  if (req.method === "PUT") {
    const body = parseJsonBody(req);
    const players = normalizePlayers(body?.players);
    const nextConfig = {
      version: 1,
      updatedAt: new Date().toISOString(),
      players
    };

    try {
      const saved = await saveLeaderboardConfig(nextConfig);
      return sendJson(res, 200, { ok: true, config: saved });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save config"
      });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
