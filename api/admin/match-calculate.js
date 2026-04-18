const { parseJsonBody, requireAdmin, sendJson } = require("../_lib/auth");
const { getLeaderboardConfig, saveLeaderboardConfig } = require("../_lib/upstash");

/**
 * ELO Calculation Logic
 * 
 * Expected_A = 1 / (1 + 10 ^ ((TeamB_avg - TeamA_avg) / 400))
 * Final K = 32 + (PerformanceFactor × 18)
 * NewELO = OldELO + FinalK × (ActualResult - ExpectedResult)
 */

function calculateProbability(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const body = parseJsonBody(req);
    const { teamA, teamB, winner, usePerformanceScaling, teamAFaction, teamBFaction } = body;

    if (!teamA || !teamB || !winner) {
      return sendJson(res, 400, { ok: false, error: "Missing required fields: teamA, teamB, winner" });
    }

    if (teamA.length < 1 || teamB.length < 1) {
      return sendJson(res, 400, { ok: false, error: "Minimum 1 player per team required." });
    }

    const config = await getLeaderboardConfig();
    const players = config.players || {};

    // Helper to get player info or default
    const getPlayerStats = (name) => {
      const key = name.toLowerCase();
      if (!players[key]) {
        players[key] = { elo: 1000, wins: 0, losses: 0, lastEloChange: 0 };
      }
      if (players[key].elo === undefined) players[key].elo = 1000;
      if (players[key].wins === undefined) players[key].wins = 0;
      if (players[key].losses === undefined) players[key].losses = 0;
      return players[key];
    };

    // Calculate Average ELO
    const teamA_avg = teamA.reduce((sum, p) => sum + getPlayerStats(p.name).elo, 0) / teamA.length;
    const teamB_avg = teamB.reduce((sum, p) => sum + getPlayerStats(p.name).elo, 0) / teamB.length;

    const expectedA = calculateProbability(teamA_avg, teamB_avg);
    const expectedB = 1 - expectedA;

    const resultA = winner === "A" ? 1 : 0;
    const resultB = winner === "B" ? 1 : 0;

    const eloChanges = {};

    // Process Team A
    const maxScoreA = Math.max(...teamA.map(p => p.score || 0), 1);
    teamA.forEach(p => {
      const stats = getPlayerStats(p.name);
      const performanceFactor = usePerformanceScaling ? (p.score || 0) / maxScoreA : 0.5;
      const k = 32 + (performanceFactor * 18);
      const change = Math.round(k * (resultA - expectedA));
      
      const clampedChange = Math.max(-50, Math.min(50, change));
      stats.elo = Math.max(0, Math.min(4000, stats.elo + clampedChange));
      stats.lastEloChange = clampedChange;
      if (resultA === 1) stats.wins++; else stats.losses++;
      
      eloChanges[p.name] = clampedChange;
    });

    // Process Team B
    const maxScoreB = Math.max(...teamB.map(p => p.score || 0), 1);
    teamB.forEach(p => {
      const stats = getPlayerStats(p.name);
      const performanceFactor = usePerformanceScaling ? (p.score || 0) / maxScoreB : 0.5;
      const k = 32 + (performanceFactor * 18);
      const change = Math.round(k * (resultB - expectedB));
      
      const clampedChange = Math.max(-50, Math.min(50, change));
      stats.elo = Math.max(0, Math.min(4000, stats.elo + clampedChange));
      stats.lastEloChange = clampedChange;
      if (resultB === 1) stats.wins++; else stats.losses++;
      
      eloChanges[p.name] = clampedChange;
    });

    // Save configuration
    config.updatedAt = new Date().toISOString();

    // Auto-create a visible match entry in config.matches
    if (!Array.isArray(config.matches)) config.matches = [];
    const teamALabel = String(teamAFaction || "Team A").trim().toUpperCase();
    const teamBLabel = String(teamBFaction || "Team B").trim().toUpperCase();
    config.matches.push({
      id: `match-${Date.now()}`,
      type: "finished",
      title: `ELO Match — ${teamALabel} vs ${teamBLabel} (${teamA.length}v${teamB.length})`,
      teamA: teamALabel,
      teamB: teamBLabel,
      scoreA: resultA,
      scoreB: resultB,
      casualtiesA: 0,
      casualtiesB: 0,
      status: "",
      date: config.updatedAt.split("T")[0],
      mediaUrl: ""
    });

    await saveLeaderboardConfig(config);

    return sendJson(res, 200, { ok: true, eloChanges });

  } catch (error) {
    console.error("Match calculation error:", error);
    return sendJson(res, 500, { ok: false, error: error.message });
  }
};
