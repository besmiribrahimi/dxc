const https = require("https");

module.exports = async function handler(req, res) {
  const universeId = "1281592938";
  const apiUrl = `https://games.roblox.com/v1/games?universeIds=${universeId}`;

  try {
    https.get(apiUrl, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => { data += chunk; });
      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const gameData = parsed.data?.[0];
          
          if (!gameData) {
            return res.status(404).json({ ok: false, error: "Game not found" });
          }

          res.status(200).json({
            ok: true,
            stats: {
              playing: gameData.playing || 0,
              visits: gameData.visits || 0,
              favorites: gameData.favoritedCount || 0,
              lastUpdated: gameData.updated || null
            }
          });
        } catch (e) {
          res.status(500).json({ ok: false, error: "Failed to parse Roblox API response" });
        }
      });
    }).on("error", (err) => {
      res.status(500).json({ ok: false, error: err.message });
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
};
