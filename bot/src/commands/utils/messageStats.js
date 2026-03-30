const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
const dataFile = path.join(dataDir, 'message-stats.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ guilds: {} }, null, 2));
  }
}

function readData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && parsed.guilds ? parsed : { guilds: {} };
  } catch {
    return { guilds: {} };
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function getGuildStats(guildId) {
  const data = readData();
  return data.guilds[guildId] || {};
}

function addMessage(guildId, userId) {
  const data = readData();

  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {};
  }

  if (!data.guilds[guildId][userId]) {
    data.guilds[guildId][userId] = { messages: 0 };
  }

  data.guilds[guildId][userId].messages += 1;
  writeData(data);
}

function getLeaderboard(guildId, limit = 10) {
  const guildStats = getGuildStats(guildId);
  const leaderboard = Object.entries(guildStats)
    .map(([userId, stats]) => ({
      userId,
      messages: stats.messages || 0,
    }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, limit);

  return leaderboard;
}

function getUserRank(userId, guildId) {
  const all = getLeaderboard(guildId, Number.MAX_SAFE_INTEGER);
  const index = all.findIndex((entry) => entry.userId === userId);
  return index >= 0 ? index + 1 : null;
}

function getUserStats(userId, guildId) {
  const guildStats = getGuildStats(guildId);
  return guildStats[userId] || null;
}

module.exports = {
  addMessage,
  getLeaderboard,
  getUserRank,
  getUserStats,
};
