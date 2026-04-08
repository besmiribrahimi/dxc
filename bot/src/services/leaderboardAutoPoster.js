const { EmbedBuilder } = require("discord.js");
const { getGuildSettings, patchGuildSettings } = require("./guildSettingsStore");
const { fetchLeaderboardData } = require("./leaderboardService");

const TICK_INTERVAL_MS = 60 * 1000;

function clampHours(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.min(168, parsed));
}

function colorToInt(hex, fallback) {
  const value = String(hex || fallback || "").trim().toUpperCase();
  const safe = /^#[0-9A-F]{6}$/.test(value) ? value : fallback;
  return Number.parseInt(String(safe).slice(1), 16);
}

function buildAutoPostEmbed(settings, data) {
  const entries = Array.isArray(data?.entries) ? data.entries.slice(0, 10) : [];
  const lines = entries.map((entry) => (
    `#${entry.rank} **${entry.player}** | Lvl ${entry.level} | K/D ${Number(entry.kd || 0).toFixed(1)} | Matches ${entry.totalMatches || 0}`
  ));

  return new EmbedBuilder()
    .setTitle("Ascend Entrenched Leaderboard")
    .setColor(colorToInt(settings?.colors?.active, "#C8A2C8"))
    .setDescription(lines.length ? lines.join("\n") : "No leaderboard entries available.")
    .addFields({
      name: "Note",
      value: "Live leaderboard standings. Not a tournament bracket."
    })
    .setFooter({
      text: `${String(settings?.brandingFooter || "Ascend Entrenched").trim() || "Ascend Entrenched"} | Auto post`
    })
    .setTimestamp(new Date(data?.updatedAt || Date.now()));
}

function startLeaderboardAutoPoster({ client, config, logger = console }) {
  let timer = null;
  let running = false;

  async function tick() {
    if (running || !client.isReady()) {
      return;
    }

    running = true;
    try {
      for (const guild of client.guilds.cache.values()) {
        const settings = getGuildSettings(guild.id, config);
        if (!settings.leaderboardAutoPostEnabled) {
          continue;
        }

        const endpoint = String(settings.leaderboardEndpoint || config.leaderboardApiUrl || "").trim();
        const channelId = String(settings.leaderboardChannelId || "").trim();
        if (!endpoint || !channelId) {
          continue;
        }

        const intervalHours = clampHours(settings.leaderboardAutoPostIntervalHours, 6);
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const lastRunMs = Date.parse(String(settings.leaderboardAutoPostLastRunAt || ""));
        const due = !Number.isFinite(lastRunMs) || (Date.now() - lastRunMs) >= intervalMs;
        if (!due) {
          continue;
        }

        try {
          const data = await fetchLeaderboardData(endpoint);
          const channel = guild.channels.cache.get(channelId)
            || await guild.channels.fetch(channelId).catch(() => null);

          if (!channel || !channel.isTextBased()) {
            logger.warn(`[AutoLeaderboard] Channel not found or invalid for guild ${guild.id}`);
            continue;
          }

          const embed = buildAutoPostEmbed(settings, data);
          await channel.send({ embeds: [embed] });

          patchGuildSettings(guild.id, {
            leaderboardAutoPostLastRunAt: new Date().toISOString(),
            leaderboardAutoPostIntervalHours: intervalHours
          }, config);

          logger.log(`[AutoLeaderboard] Posted scheduled leaderboard for guild ${guild.id}`);
        } catch (error) {
          logger.error(`[AutoLeaderboard] Failed for guild ${guild.id}`, error);
        }
      }
    } finally {
      running = false;
    }
  }

  timer = setInterval(() => {
    tick().catch((error) => logger.error("[AutoLeaderboard] Tick error", error));
  }, TICK_INTERVAL_MS);

  tick().catch((error) => logger.error("[AutoLeaderboard] Initial tick error", error));

  return function stopAutoPoster() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

module.exports = {
  startLeaderboardAutoPoster
};
