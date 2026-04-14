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
  const brandIcon = "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  const entries = Array.isArray(data?.entries) ? data.entries.slice(0, 10) : [];
  
  const lines = entries.map((entry) => {
    const rankEmoji = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : "🏅";
    return `${rankEmoji} **#${entry.rank}** \`${entry.player}\` • ELO ${Number(entry.elo || 1000)} • W/L ${Number(entry.wins || 0)}/${Number(entry.losses || 0)}`;
  });

  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Sector Control", iconURL: brandIcon })
    .setTitle("🏆 Leaderboard Standings")
    .setColor(colorToInt(settings?.colors?.active, "#3B82F6"))
    .setDescription(lines.length ? lines.join("\n\n") : "> No leaderboard entries available.")
    .setThumbnail(brandIcon)
    .addFields({
      name: "📢 Note",
      value: "```text\nLive leaderboard standings based on roster API. Not a tournament bracket.\n```"
    })
    .setFooter({
      text: `${String(settings?.brandingFooter || "Ascend Entrenched").trim()} | Auto post`,
      iconURL: brandIcon
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
