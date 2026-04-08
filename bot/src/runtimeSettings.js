const fs = require("fs");
const path = require("path");

const SETTINGS_FILE_PATH = path.resolve(__dirname, "..", "runtime-settings.json");

function toPositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function sanitizeRuntimeSettings(raw) {
  const input = raw && typeof raw === "object" ? raw : {};

  return {
    applicationsChannelId: String(input.applicationsChannelId || "").trim(),
    applicationsReviewerRoleId: String(input.applicationsReviewerRoleId || "").trim(),
    applicationsAcceptedRoleId: String(input.applicationsAcceptedRoleId || "").trim(),
    applicationCooldownMs: toPositiveInt(input.applicationCooldownMs, 120000)
  };
}

function loadRuntimeSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(SETTINGS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return sanitizeRuntimeSettings(parsed);
  } catch {
    return {};
  }
}

function saveRuntimeSettings(nextPartial) {
  const current = loadRuntimeSettings();
  const merged = sanitizeRuntimeSettings({
    ...current,
    ...(nextPartial && typeof nextPartial === "object" ? nextPartial : {})
  });

  fs.writeFileSync(SETTINGS_FILE_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

module.exports = {
  loadRuntimeSettings,
  saveRuntimeSettings,
  SETTINGS_FILE_PATH
};
