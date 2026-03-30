// Example standalone website endpoint handler logic.
// Adapt to your framework if not using Next.js.

function getBotStatsRequestHandler(req, res) {
  const token = req.headers["x-bot-token"];
  if (!token || token !== process.env.WEBSITE_API_TOKEN) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  // TODO: replace these with real values from your data source.
  const payload = {
    players: 42,
    factions: 12,
    countries: 22,
    updatedAt: new Date().toISOString(),
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = {
  getBotStatsRequestHandler,
};
