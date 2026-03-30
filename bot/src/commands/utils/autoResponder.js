const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
const dataPath = path.join(dataDir, 'autoresponder.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ guilds: {} }, null, 2));
  }
}

function readData() {
  ensureDataFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return parsed && parsed.guilds ? parsed : { guilds: {} };
  } catch {
    return { guilds: {} };
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function normalizeTrigger(trigger) {
  return String(trigger || '').trim().toLowerCase();
}

function getTriggers(guildId) {
  const data = readData();
  return data.guilds[guildId] || {};
}

function setTrigger(guildId, trigger, response, options = {}) {
  const normalized = normalizeTrigger(trigger);
  if (!normalized || !response) {
    return false;
  }

  const data = readData();

  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {};
  }

  data.guilds[guildId][normalized] = {
    trigger: String(trigger).trim(),
    response: String(response),
    exactMatch: Boolean(options.exactMatch),
    embedResponse: Boolean(options.embedResponse),
    createdBy: options.createdBy || 'Unknown',
    createdAt: options.createdAt || new Date().toISOString(),
  };

  writeData(data);
  return true;
}

function removeTrigger(guildId, trigger) {
  const normalized = normalizeTrigger(trigger);
  if (!normalized) {
    return false;
  }

  const data = readData();
  if (!data.guilds[guildId] || !data.guilds[guildId][normalized]) {
    return false;
  }

  delete data.guilds[guildId][normalized];
  writeData(data);
  return true;
}

function getTriggerCount(guildId) {
  return Object.keys(getTriggers(guildId)).length;
}

function findMatchingTrigger(guildId, content) {
  const text = String(content || '').toLowerCase().trim();
  if (!text) {
    return null;
  }

  const triggers = Object.values(getTriggers(guildId));
  // Prefer longer triggers first for contains-matches.
  triggers.sort((a, b) => (b.trigger || '').length - (a.trigger || '').length);

  for (const trigger of triggers) {
    const key = normalizeTrigger(trigger.trigger);
    if (!key) {
      continue;
    }

    if (trigger.exactMatch && text === key) {
      return trigger;
    }

    if (!trigger.exactMatch && text.includes(key)) {
      return trigger;
    }
  }

  return null;
}

module.exports = {
  getTriggers,
  setTrigger,
  removeTrigger,
  getTriggerCount,
  findMatchingTrigger,
};
