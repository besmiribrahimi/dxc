const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

async function fetchLeaderboardConfig(config) {
  const endpoint = String(config.leaderboardApiUrl || "").trim();
  if (!endpoint) {
    throw new Error("LEADERBOARD_API_URL is not configured in bot environment");
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Leaderboard API failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.config || typeof payload.config !== "object") {
    throw new Error("Leaderboard API returned an invalid payload");
  }

  return payload.config;
}

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

function calculateScore(level, kd, rank) {
  return Number(((level * 12) + (kd * 18) + Math.max(0, 14 - rank)).toFixed(1));
}

function buildRankedLeaderboard(config, limit) {
  const topLimit = Math.max(1, Math.min(20, Number(limit) || 10));
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

      if (bStats.kd !== aStats.kd) {
        return bStats.kd - aStats.kd;
      }

      return a.localeCompare(b);
    })
    .slice(0, topLimit)
    .map((key, index) => {
      const stats = players[key] || { level: 1, kd: 1.0 };
      const rank = index + 1;
      return {
        player: key,
        rank,
        level: stats.level,
        kd: stats.kd,
        score: calculateScore(stats.level, stats.kd, rank)
      };
    });
}

function getMuteDurationMs(minutes) {
  const safeMinutes = Math.max(1, Math.min(40320, Number(minutes) || 0));
  return safeMinutes * 60 * 1000;
}

const slashCommandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency and health"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show webhook queue status"),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show globally synced leaderboard standings")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("How many top players to show (1-20)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  new SlashCommandBuilder()
    .setName("webhooktest")
    .setDescription("Send a test leaderboard update embed")
    .addStringOption((option) =>
      option
        .setName("group")
        .setDescription("Group label")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("Player name")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status type")
        .setRequired(true)
        .addChoices(
          { name: "winner", value: "winner" },
          { name: "eliminated", value: "eliminated" },
          { name: "info", value: "info" }
        )
    )
    .addNumberOption((option) =>
      option
        .setName("score")
        .setDescription("Score value")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("highlight")
        .setDescription("Match highlight text")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a member for a number of minutes")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Member to timeout")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("Timeout duration in minutes (1-40320)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for timeout")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Member to kick")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for kick")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_days")
        .setDescription("Delete recent messages from this many days (0-7)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for ban")
        .setRequired(false)
    )
];

const slashCommands = slashCommandBuilders.map((builder) => builder.toJSON());

async function registerSlashCommands(client, config) {
  if (!client.application) {
    throw new Error("Discord application is not ready for command registration");
  }

  if (config.discordGuildId) {
    try {
      await client.application.commands.set(slashCommands, config.discordGuildId);
      return { scope: "guild", guildId: config.discordGuildId, count: slashCommands.length };
    } catch (error) {
      const code = Number(error?.code || 0);
      const shouldFallback = code === 50001 || Number(error?.status || 0) === 403;

      if (!shouldFallback) {
        throw error;
      }

      // If guild registration fails (usually missing access or wrong guild ID),
      // fall back to global registration so commands still appear eventually.
      await client.application.commands.set(slashCommands);
      return {
        scope: "global",
        count: slashCommands.length,
        warning: `Guild registration failed for ${config.discordGuildId}; fallback to global commands.`
      };
    }
  }

  await client.application.commands.set(slashCommands);
  return { scope: "global", count: slashCommands.length };
}

async function handleSlashCommand(interaction, context) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "ping") {
    const wsPing = Math.round(interaction.client.ws.ping || 0);
    await interaction.reply({
      content: `Pong. Websocket ping: ${wsPing} ms`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "queue") {
    await interaction.reply({
      content: `Queue size: ${context.updateQueue.size()} | Rate: 1 message / ${context.config.queueIntervalMs} ms`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "leaderboard") {
    const limit = interaction.options.getInteger("limit") || 10;

    await interaction.deferReply({ ephemeral: true });

    try {
      const configData = await fetchLeaderboardConfig(context.config);
      const ranked = buildRankedLeaderboard(configData, limit);

      if (!ranked.length) {
        await interaction.editReply({
          content: "Leaderboard is currently empty."
        });
        return;
      }

      const lines = ranked.map((entry) => (
        `#${entry.rank} ${entry.player} | Lvl ${entry.level} | K/D ${entry.kd.toFixed(1)} | Score ${entry.score}`
      ));

      const embed = new EmbedBuilder()
        .setTitle("Global Synced Leaderboard")
        .setColor(0xdb2b2b)
        .setDescription(lines.join("\n").slice(0, 4000))
        .setFooter({
          text: configData?.updatedAt
            ? `Last sync: ${new Date(configData.updatedAt).toLocaleString()}`
            : "Last sync: unknown"
        })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `Failed to load leaderboard sync: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }

    return;
  }

  if (interaction.commandName === "webhooktest") {
    const payload = {
      group: interaction.options.getString("group", true),
      player: interaction.options.getString("player", true),
      status: interaction.options.getString("status", true),
      score: interaction.options.getNumber("score", true),
      matchHighlight: interaction.options.getString("highlight", true)
    };

    context.updateQueue.enqueue(
      async () => context.handleAcceptedEvent(payload, "leaderboard"),
      { source: "slash:webhooktest", group: payload.group }
    );

    await interaction.reply({
      content: "Test update queued and will be sent to the configured channel shortly.",
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "mute") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") || `Muted by ${interaction.user.tag}`;
    const durationMs = getMuteDurationMs(minutes);

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "User is not in this server.", ephemeral: true });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        content: "I cannot mute that member (role hierarchy or permissions issue).",
        ephemeral: true
      });
      return;
    }

    await member.timeout(durationMs, reason);
    await interaction.reply({
      content: `Muted ${user.tag} for ${minutes} minute(s). Reason: ${reason}`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "kick") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || `Kicked by ${interaction.user.tag}`;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: "User is not in this server.", ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        content: "I cannot kick that member (role hierarchy or permissions issue).",
        ephemeral: true
      });
      return;
    }

    await member.kick(reason);
    await interaction.reply({
      content: `Kicked ${user.tag}. Reason: ${reason}`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "ban") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || `Banned by ${interaction.user.tag}`;
    const deleteDays = interaction.options.getInteger("delete_days") || 0;

    await interaction.guild.members.ban(user.id, {
      reason,
      deleteMessageSeconds: deleteDays * 86400
    });

    await interaction.reply({
      content: `Banned ${user.tag}. Reason: ${reason}. Deleted messages: ${deleteDays} day(s).`,
      ephemeral: true
    });
  }
}

module.exports = {
  registerSlashCommands,
  handleSlashCommand
};
