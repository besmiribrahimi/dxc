const { getLeaderboardConfig } = require("./_lib/upstash");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const config = await getLeaderboardConfig();

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    res.statusCode = 200;
    res.end(JSON.stringify({
      ok: true,
      leagueStructure: config.leagueStructure || {},
      leagueStandings: config.leagueStandings || {},
      leagueSchedule: config.leagueSchedule || []
    }));
  } catch (error) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 500;
    res.end(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load league config"
    }));
  }
};
