const { parseJsonBody, sendJson } = require("./_lib/auth");
const {
  getActiveQueueEntries,
  upsertQueueEntry,
  removeQueueEntry
} = require("./_lib/lfgQueueStore");

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).trim();
      }

      return trimmed;
    }
  }

  return "";
}

function acceptedApiTokens() {
  const keys = [
    "LFG_QUEUE_API_TOKEN",
    "WEBSITE_API_TOKEN",
    "BOT_WEBHOOK_SECRET",
    "WEBHOOK_SHARED_SECRET",
    "ADMIN_PANEL_SECRET"
  ];

  const tokens = keys
    .map((key) => firstEnv([key]))
    .filter(Boolean);

  return [...new Set(tokens)];
}

function getProvidedToken(req) {
  const direct = String(req.headers["x-api-token"] || "").trim();
  if (direct) {
    return direct.replace(/^['\"]|['\"]$/g, "").trim();
  }

  const authHeader = String(req.headers.authorization || req.headers.Authorization || "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim().replace(/^['\"]|['\"]$/g, "").trim();
  }

  return "";
}

function requireApiToken(req, res) {
  const expected = acceptedApiTokens();
  if (!expected.length) {
    return sendJson(res, 500, { ok: false, error: "Missing queue auth env var" });
  }

  const provided = getProvidedToken(req);
  if (!provided || !expected.includes(provided)) {
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const entries = await getActiveQueueEntries();
      return sendJson(res, 200, { ok: true, entries });
    } catch (error) {
      return sendJson(res, 200, {
        ok: true,
        entries: [],
        warning: error instanceof Error ? error.message : "LFG queue unavailable"
      });
    }
  }

  if (req.method === "POST") {
    const authError = requireApiToken(req, res);
    if (authError) {
      return;
    }

    const body = parseJsonBody(req);
    try {
      const entries = await upsertQueueEntry({
        userId: body?.userId,
        username: body?.username,
        guildId: body?.guildId,
        guildName: body?.guildName,
        status: body?.status || "Looking for 1v1",
        ttlSeconds: body?.ttlSeconds || 3600
      });

      return sendJson(res, 200, { ok: true, entries });
    } catch (error) {
      return sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update queue"
      });
    }
  }

  if (req.method === "DELETE") {
    const authError = requireApiToken(req, res);
    if (authError) {
      return;
    }

    const body = parseJsonBody(req);
    try {
      const entries = await removeQueueEntry(body?.userId);
      return sendJson(res, 200, { ok: true, entries });
    } catch (error) {
      return sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update queue"
      });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
