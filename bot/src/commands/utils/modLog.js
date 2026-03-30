const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
const actionsPath = path.join(dataDir, 'mod-actions.json');
const logConfigPath = path.join(__dirname, '..', 'logConfig.json');

function ensureDataFile(filePath, initialData) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDataFile(filePath, data);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function appendUserAction(guildId, userId, entry) {
  ensureDataFile(actionsPath, { guilds: {} });
  const data = readJson(actionsPath, { guilds: {} });

  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {};
  }

  if (!data.guilds[guildId][userId]) {
    data.guilds[guildId][userId] = [];
  }

  data.guilds[guildId][userId].push(entry);
  writeJson(actionsPath, data);
}

function getUserActions(guildId, userId) {
  ensureDataFile(actionsPath, { guilds: {} });
  const data = readJson(actionsPath, { guilds: {} });
  const actions = data.guilds[guildId]?.[userId] || [];

  return [...actions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function getLogChannelId(guildId) {
  const config = readJson(logConfigPath, {});
  return config[guildId]?.logChannelId || null;
}

async function sendModLog(guild, action, moderator, target, reason, extraFields = []) {
  const entry = {
    action,
    moderatorId: moderator?.id || null,
    moderatorTag: moderator?.tag || 'Unknown',
    targetId: target?.id || null,
    targetTag: target?.tag || 'Unknown',
    reason: reason || 'No reason provided',
    timestamp: Date.now(),
    extraFields: Array.isArray(extraFields) ? extraFields : [],
  };

  if (entry.targetId) {
    appendUserAction(guild.id, entry.targetId, entry);
  }

  const logChannelId = getLogChannelId(guild.id);
  if (!logChannelId) {
    return;
  }

  const channel = guild.channels.cache.get(logChannelId) || (await guild.channels.fetch(logChannelId).catch(() => null));
  if (!channel || !channel.isTextBased()) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#B00000')
    .setTitle(`Moderation Action: ${action}`)
    .addFields(
      { name: 'Moderator', value: moderator ? `${moderator.tag} (${moderator.id})` : 'Unknown', inline: true },
      { name: 'Target', value: target ? `${target.tag} (${target.id})` : 'Unknown', inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false }
    )
    .setTimestamp();

  for (const field of entry.extraFields) {
    if (!field || !field.name || typeof field.value === 'undefined') {
      continue;
    }

    embed.addFields({
      name: String(field.name),
      value: String(field.value),
      inline: Boolean(field.inline),
    });
  }

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  sendModLog,
  getUserActions,
};
