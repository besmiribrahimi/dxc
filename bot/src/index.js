const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const config = require("./config");
const { UpdateQueue } = require("./queue/UpdateQueue");
const { buildEventEmbed, EVENT_TYPES } = require("./events");
const { createApiServer } = require("./server/createApiServer");
const { registerSlashCommands, handleSlashCommand } = require("./commands/slashCommands");
const { saveRuntimeSettings } = require("./runtimeSettings");
const { startLeaderboardAutoPoster } = require("./services/leaderboardAutoPoster");
const { getGuildSettings } = require("./services/guildSettingsStore");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const updateQueue = new UpdateQueue({
  intervalMs: config.queueIntervalMs,
  maxSize: config.maxQueueSize,
  onTaskError: (error, metadata) => {
    console.error("[Queue Task Error]", metadata, error);
  }
});

let stopLeaderboardAutoPoster = null;

async function resolveTargetChannel() {
  const fromCache = client.channels.cache.get(config.discordChannelId);
  if (fromCache && fromCache.isTextBased()) {
    return fromCache;
  }

  const fetched = await client.channels.fetch(config.discordChannelId);
  if (!fetched || !fetched.isTextBased()) {
    throw new Error(`Configured channel ${config.discordChannelId} is not a text channel`);
  }

  return fetched;
}

function normalizeDirectMessageContent(title, message) {
  const safeTitle = String(title || "Ascend Entrenched Broadcast").trim() || "Ascend Entrenched Broadcast";
  const safeMessage = String(message || "").trim();
  const content = `**${safeTitle}**\n${safeMessage}`.trim();

  if (content.length <= 1900) {
    return content;
  }

  return `${content.slice(0, 1897)}...`;
}

function welcomeColor(settings) {
  const raw = String(settings?.colors?.active || "#C8A2C8").trim();
  const safe = /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : "#C8A2C8";
  return Number.parseInt(safe.slice(1), 16);
}

function buildWelcomeDescription(member, autoRoleId) {
  const guildName = String(member?.guild?.name || "this server");
  const memberCount = Number(member?.guild?.memberCount || 0);
  const mention = `<@${member.id}>`;
  const lines = [
    `${mention} just joined **${guildName}**.`,
    `You are member **#${memberCount}**.`,
    "Use /1v1 whenever you are looking for a match."
  ];

  if (autoRoleId) {
    lines.splice(2, 0, `Your starting role is <@&${autoRoleId}>.`);
  }

  return lines.join("\n");
}

async function handleAcceptedEvent(payload, eventType) {
  if (!client.isReady()) {
    throw new Error("Discord client is not ready yet");
  }

  if (eventType === EVENT_TYPES.RUNTIME_SETTINGS) {
    const next = saveRuntimeSettings({
      applicationsPanelChannelId: String(payload?.applicationsPanelChannelId || "").trim(),
      applicationsChannelId: String(payload?.applicationsChannelId || "").trim(),
      notificationUserIds: Array.isArray(payload?.notificationUserIds) ? payload.notificationUserIds : []
    });

    config.applicationsPanelChannelId = next.applicationsPanelChannelId;
    config.applicationsChannelId = next.applicationsChannelId;
    config.notificationUserIds = Array.isArray(next.notificationUserIds) ? next.notificationUserIds : [];

    const channel = await resolveTargetChannel();
    const embed = buildEventEmbed({
      message: `Runtime settings synced. Panel: ${next.applicationsPanelChannelId || "Not set"}, Apply Receive: ${next.applicationsChannelId || "Not set"}, Notify IDs: ${(next.notificationUserIds || []).length}`
    }, eventType);
    await channel.send({ embeds: [embed] });
    return;
  }

  if (eventType === EVENT_TYPES.NOTIFY) {
    const ids = Array.isArray(payload?.recipientIds)
      ? payload.recipientIds.map((value) => String(value || "").trim()).filter((value) => /^\d{8,}$/.test(value))
      : [];
    const uniqueIds = [...new Set(ids)];
    const message = String(payload?.message || "").trim();
    const title = String(payload?.title || "Ascend Entrenched Broadcast").trim();
    const dmContent = normalizeDirectMessageContent(title, message);

    let sent = 0;
    let failed = 0;
    const failedIds = [];
    for (const userId of uniqueIds) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) {
        failed += 1;
        failedIds.push(userId);
        continue;
      }

      try {
        await user.send({
          content: dmContent,
          allowedMentions: { parse: [] }
        });
        sent += 1;
      } catch {
        failed += 1;
        failedIds.push(userId);
      }
    }

    try {
      const channel = await resolveTargetChannel();
      const failedSuffix = failedIds.length
        ? ` Failed IDs: ${failedIds.slice(0, 5).join(", ")}${failedIds.length > 5 ? "..." : ""}.`
        : "";

      await channel.send({
        embeds: [buildEventEmbed({
          message: `${title} sent to ${sent}/${uniqueIds.length} users${failed ? ` (${failed} failed)` : ""}.${failedSuffix}`
        }, EVENT_TYPES.NOTIFY)]
      });
    } catch (summaryError) {
      console.warn("[Notify Summary Error]", summaryError instanceof Error ? summaryError.message : summaryError);
    }

    return;
  }

  const channel = await resolveTargetChannel();
  const embed = buildEventEmbed(payload, eventType);
  await channel.send({ embeds: [embed] });
}

async function start() {
  client.once("clientReady", async () => {
    console.log(`Discord bot online as ${client.user.tag}`);

    try {
      const registration = await registerSlashCommands(client, config);
      if (registration.scope === "guild") {
        console.log(`Registered ${registration.count} slash commands in guild ${registration.guildId}`);
      } else {
        console.log(`Registered ${registration.count} global slash commands`);
      }

      if (registration.warning) {
        console.warn(`[Slash Command Registration Warning] ${registration.warning}`);
      }
    } catch (error) {
      console.error("[Slash Command Registration Error]", error);
    }

    if (!stopLeaderboardAutoPoster) {
      stopLeaderboardAutoPoster = startLeaderboardAutoPoster({
        client,
        config,
        logger: console
      });
    }
  });

  client.on("error", (error) => {
    console.error("[Discord Client Error]", error);
  });

  client.on("guildMemberAdd", async (member) => {
    try {
      const settings = getGuildSettings(member.guild.id, config);
      const autoRoleId = String(settings?.autoRoleId || "").trim();

      if (autoRoleId) {
        const role = member.guild.roles.cache.get(autoRoleId)
          || await member.guild.roles.fetch(autoRoleId).catch(() => null);

        if (role && !role.managed) {
          const me = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
          if (me && role.position < me.roles.highest.position) {
            await member.roles.add(role.id, "Auto role on member join").catch(() => null);
          }
        }
      }

      const channelId = String(settings?.welcomeChannelId || "").trim();
      if (!channelId) {
        return;
      }

      const channel = member.guild.channels.cache.get(channelId)
        || await member.guild.channels.fetch(channelId).catch(() => null);

      if (!channel || !channel.isTextBased()) {
        return;
      }

      const description = buildWelcomeDescription(member, autoRoleId);
      const embed = new EmbedBuilder()
        .setTitle(`Welcome to ${member.guild.name}`)
        .setColor(welcomeColor(settings))
        .setDescription(description.slice(0, 4096))
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: String(settings?.brandingFooter || "Ascend Entrenched") })
        .setTimestamp(new Date());

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("[Welcome Message Error]", error instanceof Error ? error.message : error);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      await handleSlashCommand(interaction, {
        config,
        updateQueue,
        handleAcceptedEvent,
        saveRuntimeSettings
      });
    } catch (error) {
      console.error("[Interaction Error]", error);

      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Command failed. Check bot logs.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  });

  await client.login(config.discordToken);

  const app = createApiServer({
    config,
    queue: updateQueue,
    onAcceptedEvent: handleAcceptedEvent
  });

  app.listen(config.port, () => {
    console.log(`Webhook API listening on port ${config.port}`);
    console.log(`Queue rate: 1 message / ${config.queueIntervalMs} ms`);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception]", error);
});

process.on("SIGINT", () => {
  if (typeof stopLeaderboardAutoPoster === "function") {
    stopLeaderboardAutoPoster();
  }

  process.exit(0);
});

process.on("SIGTERM", () => {
  if (typeof stopLeaderboardAutoPoster === "function") {
    stopLeaderboardAutoPoster();
  }

  process.exit(0);
});

start().catch((error) => {
  console.error("Failed to start bot", error);
  process.exit(1);
});
