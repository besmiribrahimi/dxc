const { parseJsonBody, requireAdmin, sendJson } = require("../_lib/auth");
const { getLeaderboardConfig, saveLeaderboardConfig } = require("../_lib/upstash");
const {
  sendLeaderboardUpdate,
  sendMatchHighlight,
  sendSubstitution
} = require("../_lib/bot-webhook");

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

function normalizeOrder(rawOrder, playerKeys) {
  const keys = Array.isArray(playerKeys) ? playerKeys : [];
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

function toPositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getTopLimit() {
  return toPositiveInt(process.env.BOT_WEBHOOK_TOP_LIMIT, 10);
}

function getMaxEventsPerSave() {
  return toPositiveInt(process.env.BOT_WEBHOOK_MAX_EVENTS_PER_SAVE, 16);
}

function calculateScore(level, kd, rank) {
  return Number(((level * 12) + (kd * 18) + Math.max(0, 14 - rank)).toFixed(1));
}

function rankPlayers(config, limit) {
  const topLimit = Math.max(1, Number(limit) || 1);
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
    .slice(0, topLimit)
    .map((key, index) => {
      const stats = players[key] || { level: 1, kd: 1.0 };
      const rank = index + 1;
      return {
        key,
        player: key,
        rank,
        level: stats.level,
        kd: stats.kd,
        score: calculateScore(stats.level, stats.kd, rank)
      };
    });
}

function buildLeaderboardDeltaEvents(previousTop, currentTop) {
  const previousMap = new Map(previousTop.map((entry) => [entry.key, entry]));
  const currentMap = new Map(currentTop.map((entry) => [entry.key, entry]));
  const events = [];

  currentTop.forEach((entry) => {
    const previous = previousMap.get(entry.key);
    if (!previous) {
      events.push({
        group: "GLOBAL",
        player: entry.player,
        status: "winner",
        score: entry.score,
        matchHighlight: `${entry.player} entered Top ${currentTop.length} at #${entry.rank}.`
      });
      return;
    }

    if (entry.rank < previous.rank) {
      events.push({
        group: "GLOBAL",
        player: entry.player,
        status: "winner",
        score: entry.score,
        matchHighlight: `${entry.player} climbed from #${previous.rank} to #${entry.rank}.`
      });
      return;
    }

    if (entry.rank > previous.rank) {
      events.push({
        group: "GLOBAL",
        player: entry.player,
        status: "eliminated",
        score: entry.score,
        matchHighlight: `${entry.player} dropped from #${previous.rank} to #${entry.rank}.`
      });
      return;
    }

    if (entry.level !== previous.level || entry.kd !== previous.kd) {
      events.push({
        group: "GLOBAL",
        player: entry.player,
        status: "info",
        score: entry.score,
        matchHighlight: `${entry.player} stayed at #${entry.rank} (Lvl ${previous.level}->${entry.level}, K/D ${previous.kd}->${entry.kd}).`
      });
    }
  });

  previousTop.forEach((entry) => {
    if (!currentMap.has(entry.key)) {
      events.push({
        group: "GLOBAL",
        player: entry.player,
        status: "eliminated",
        score: entry.score,
        matchHighlight: `${entry.player} dropped out of Top ${currentTop.length}.`
      });
    }
  });

  return events;
}

function buildLeaderHighlightEvent(previousTop, currentTop) {
  const previousLeader = previousTop[0] || null;
  const currentLeader = currentTop[0] || null;

  if (!currentLeader) {
    return null;
  }

  if (!previousLeader || previousLeader.key !== currentLeader.key) {
    return {
      group: "GLOBAL",
      player: currentLeader.player,
      status: "winner",
      score: currentLeader.score,
      matchHighlight: previousLeader
        ? `${currentLeader.player} took #1 from ${previousLeader.player}.`
        : `${currentLeader.player} is now #1 on the leaderboard.`
    };
  }

  if (currentLeader.score !== previousLeader.score) {
    return {
      group: "GLOBAL",
      player: currentLeader.player,
      status: "info",
      score: currentLeader.score,
      matchHighlight: `${currentLeader.player} reinforced #1 (${previousLeader.score} -> ${currentLeader.score} points).`
    };
  }

  return null;
}

function buildSubstitutionEvents(previousTop, currentTop) {
  const previousMap = new Map(previousTop.map((entry) => [entry.key, entry]));
  const currentMap = new Map(currentTop.map((entry) => [entry.key, entry]));

  const entered = currentTop.filter((entry) => !previousMap.has(entry.key));
  const dropped = previousTop.filter((entry) => !currentMap.has(entry.key));

  const pairCount = Math.min(entered.length, dropped.length, 4);
  const events = [];

  for (let index = 0; index < pairCount; index += 1) {
    events.push({
      group: "GLOBAL",
      playerOut: dropped[index].player,
      playerIn: entered[index].player,
      reason: `Top ${currentTop.length} rotation after leaderboard update`
    });
  }

  return events;
}

async function dispatchBotSyncEvents(previousConfig, currentConfig) {
  const topLimit = getTopLimit();
  const maxEvents = getMaxEventsPerSave();

  const previousTop = rankPlayers(previousConfig, topLimit);
  const currentTop = rankPlayers(currentConfig, topLimit);

  const leaderboardEvents = buildLeaderboardDeltaEvents(previousTop, currentTop).slice(0, maxEvents);
  const highlightEvent = buildLeaderHighlightEvent(previousTop, currentTop);
  const substitutionEvents = buildSubstitutionEvents(previousTop, currentTop);

  const dispatches = [];

  for (const event of leaderboardEvents) {
    dispatches.push(sendLeaderboardUpdate(event));
  }

  if (highlightEvent) {
    dispatches.push(sendMatchHighlight(highlightEvent));
  }

  for (const event of substitutionEvents) {
    dispatches.push(sendSubstitution(event));
  }

  const results = await Promise.all(dispatches);

  const summary = {
    attempted: results.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  results.forEach((result) => {
    if (result?.ok) {
      summary.sent += 1;
      return;
    }

    if (result?.skipped) {
      summary.skipped += 1;
      return;
    }

    summary.failed += 1;
    if (result?.error) {
      summary.errors.push(result.error);
    }
  });

  return summary;
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
    const previousConfig = await getLeaderboardConfig().catch(() => ({
      version: 1,
      updatedAt: null,
      players: {},
      order: [],
      botSettings: {
        applicationsPanelChannelId: "",
        applicationsChannelId: "",
        notificationUserIds: []
      }
    }));

    const body = parseJsonBody(req);
    const players = normalizePlayers(body?.players);
    const order = normalizeOrder(body?.order, Object.keys(players));
    const existingBotSettings = previousConfig?.botSettings && typeof previousConfig.botSettings === "object"
      ? previousConfig.botSettings
      : {
        applicationsPanelChannelId: "",
        applicationsChannelId: "",
        notificationUserIds: []
      };
    const nextConfig = {
      version: 1,
      updatedAt: new Date().toISOString(),
      players,
      order,
      botSettings: existingBotSettings
    };

    try {
      const saved = await saveLeaderboardConfig(nextConfig);
      const botDispatch = await dispatchBotSyncEvents(previousConfig, saved);
      return sendJson(res, 200, { ok: true, config: saved, botDispatch });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save config"
      });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
