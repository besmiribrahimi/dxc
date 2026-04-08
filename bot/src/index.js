const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { UpdateQueue } = require("./queue/UpdateQueue");
const { buildEventEmbed, EVENT_TYPES } = require("./events");
const { createApiServer } = require("./server/createApiServer");
const { registerSlashCommands, handleSlashCommand } = require("./commands/slashCommands");
const { saveRuntimeSettings } = require("./runtimeSettings");
const { startLeaderboardAutoPoster } = require("./services/leaderboardAutoPoster");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
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

    let sent = 0;
    let failed = 0;
    for (const userId of uniqueIds) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) {
        failed += 1;
        continue;
      }

      try {
        await user.send({
          embeds: [buildEventEmbed({
            player: "Ascend Entrenched",
            status: "info",
            score: 0,
            matchHighlight: message,
            message: `${title}: ${message}`
          }, EVENT_TYPES.NOTIFY)]
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    const channel = await resolveTargetChannel();
    await channel.send({
      embeds: [buildEventEmbed({
        message: `${title} sent to ${sent}/${uniqueIds.length} users${failed ? ` (${failed} failed)` : ""}.`
      }, EVENT_TYPES.NOTIFY)]
    });
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
