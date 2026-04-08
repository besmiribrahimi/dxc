const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { UpdateQueue } = require("./queue/UpdateQueue");
const { buildEventEmbed } = require("./events");
const { createApiServer } = require("./server/createApiServer");

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

  const channel = await resolveTargetChannel();
  const embed = buildEventEmbed(payload, eventType);
  await channel.send({ embeds: [embed] });
}

async function start() {
  client.once("ready", () => {
    console.log(`Discord bot online as ${client.user.tag}`);
  });

  client.on("error", (error) => {
    console.error("[Discord Client Error]", error);
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

start().catch((error) => {
  console.error("Failed to start bot", error);
  process.exit(1);
});
