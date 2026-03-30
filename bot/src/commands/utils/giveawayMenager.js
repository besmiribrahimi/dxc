const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', '..', 'data');
const dataPath = path.join(dataDir, 'giveaways.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ giveaways: [] }, null, 2));
  }
}

function readData() {
  ensureDataFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return Array.isArray(parsed.giveaways) ? parsed : { giveaways: [] };
  } catch {
    return { giveaways: [] };
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function addGiveaway(giveaway) {
  const data = readData();
  data.giveaways.push({
    ...giveaway,
    createdAt: Date.now(),
  });
  writeData(data);
  return true;
}

function getGiveaway(messageId) {
  return readData().giveaways.find((g) => g.messageId === messageId) || null;
}

function updateGiveaway(messageId, updates) {
  const data = readData();
  const index = data.giveaways.findIndex((g) => g.messageId === messageId);

  if (index < 0) {
    return false;
  }

  data.giveaways[index] = {
    ...data.giveaways[index],
    ...updates,
  };

  writeData(data);
  return true;
}

function addParticipant(messageId, userId) {
  const giveaway = getGiveaway(messageId);
  if (!giveaway) {
    return false;
  }

  const participants = Array.isArray(giveaway.participants) ? giveaway.participants : [];
  if (!participants.includes(userId)) {
    participants.push(userId);
  }

  return updateGiveaway(messageId, { participants });
}

function removeParticipant(messageId, userId) {
  const giveaway = getGiveaway(messageId);
  if (!giveaway) {
    return false;
  }

  const participants = (giveaway.participants || []).filter((id) => id !== userId);
  return updateGiveaway(messageId, { participants });
}

module.exports = {
  addGiveaway,
  getGiveaway,
  updateGiveaway,
  addParticipant,
  removeParticipant,
};
