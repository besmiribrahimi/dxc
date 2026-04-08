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
      return value.trim();
    }
  }

  return "";
}

function expectedApiToken() {
  return firstEnv(["WEBSITE_API_TOKEN", "ADMIN_PANEL_SECRET"]);
}

function getProvidedToken(req) {
  const direct = String(req.headers["x-api-token"] || "").trim();
  if (direct) {
    return direct;
  }

  const authHeader = String(req.headers.authorization || req.headers.Authorization || "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

function requireApiToken(req, res) {
  const expected = expectedApiToken();
  if (!expected) {
    return sendJson(res, 500, { ok: false, error: "Missing WEBSITE_API_TOKEN env var" });
  }

  const provided = getProvidedToken(req);
  if (!provided || provided !== expected) {
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
