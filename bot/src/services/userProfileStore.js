const fs = require("fs");
const path = require("path");

const PROFILES_FILE_PATH = path.resolve(__dirname, "..", "..", "user-profiles.json");

function loadAllProfiles() {
  try {
    if (!fs.existsSync(PROFILES_FILE_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(PROFILES_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllProfiles(profiles) {
  fs.writeFileSync(PROFILES_FILE_PATH, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
}

function getUserProfile(guildId, userId) {
  const safeGuildId = String(guildId || "").trim();
  const safeUserId = String(userId || "").trim();
  if (!safeGuildId || !safeUserId) {
    return null;
  }

  const profiles = loadAllProfiles();
  const guildProfiles = profiles[safeGuildId] && typeof profiles[safeGuildId] === "object"
    ? profiles[safeGuildId]
    : {};

  const profile = guildProfiles[safeUserId];
  return profile && typeof profile === "object" ? profile : null;
}

function upsertUserProfileFromTicket(guildId, userId, payload) {
  const safeGuildId = String(guildId || "").trim();
  const safeUserId = String(userId || "").trim();
  if (!safeGuildId || !safeUserId) {
    throw new Error("guildId and userId are required");
  }

  const profiles = loadAllProfiles();
  const guildProfiles = profiles[safeGuildId] && typeof profiles[safeGuildId] === "object"
    ? profiles[safeGuildId]
    : {};

  const current = guildProfiles[safeUserId] && typeof guildProfiles[safeUserId] === "object"
    ? guildProfiles[safeUserId]
    : {};

  guildProfiles[safeUserId] = {
    robloxUsername: String(payload?.robloxUsername || current.robloxUsername || "").trim(),
    country: String(payload?.country || current.country || "").trim(),
    faction: String(payload?.faction || current.faction || "").trim(),
    device: String(payload?.device || current.device || "").trim(),
    classesPlayed: String(payload?.classesPlayed || current.classesPlayed || "").trim(),
    totalSubmissions: Number.isFinite(Number(current.totalSubmissions)) ? Number(current.totalSubmissions) + 1 : 1,
    updatedAt: new Date().toISOString()
  };

  profiles[safeGuildId] = guildProfiles;
  saveAllProfiles(profiles);
  return guildProfiles[safeUserId];
}

module.exports = {
  PROFILES_FILE_PATH,
  getUserProfile,
  upsertUserProfileFromTicket
};
