const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function toPositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

module.exports = {
  discordToken: requireEnv("DISCORD_BOT_TOKEN"),
  discordChannelId: requireEnv("DISCORD_CHANNEL_ID"),
  port: toPositiveInt(process.env.PORT, 3001),
  webhookSharedSecret: String(process.env.WEBHOOK_SHARED_SECRET || "").trim(),
  queueIntervalMs: toPositiveInt(process.env.QUEUE_INTERVAL_MS, 1200),
  maxQueueSize: toPositiveInt(process.env.MAX_QUEUE_SIZE, 200)
};
