const { sendJson } = require("./_lib/auth");
const { getLeaderboardConfig } = require("./_lib/upstash");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const config = await getLeaderboardConfig();
    return sendJson(res, 200, { ok: true, config });
  } catch (error) {
    return sendJson(res, 200, {
      ok: true,
      config: {
        version: 1,
        updatedAt: null,
        players: {},
        order: [],
        extraPlayers: [],
        transfers: [],
        clips: []
      },
      warning: error instanceof Error ? error.message : "KV not available"
    });
  }
};
