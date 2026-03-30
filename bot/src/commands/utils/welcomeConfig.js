const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
const dataPath = path.join(dataDir, 'welcome-config.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
  }
}

function readConfig() {
  ensureDataFile();

  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  ensureDataFile();
  fs.writeFileSync(dataPath, JSON.stringify(config, null, 2));
}

function setWelcomeChannel(guildId, channelId) {
  const config = readConfig();
  if (!config[guildId]) {
    config[guildId] = {};
  }

  config[guildId].welcomeChannelId = channelId;
  writeConfig(config);
  return true;
}

function setLeaveChannel(guildId, channelId) {
  const config = readConfig();
  if (!config[guildId]) {
    config[guildId] = {};
  }

  config[guildId].leaveChannelId = channelId;
  writeConfig(config);
  return true;
}

function getWelcomeChannel(guildId) {
  return readConfig()[guildId]?.welcomeChannelId || null;
}

function getLeaveChannel(guildId) {
  return readConfig()[guildId]?.leaveChannelId || null;
}

module.exports = {
  setWelcomeChannel,
  setLeaveChannel,
  getWelcomeChannel,
  getLeaveChannel,
};
