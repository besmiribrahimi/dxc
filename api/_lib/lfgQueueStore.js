function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getUpstashUrl() {
  return firstEnv([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_KV_REST_API_URL",
    "UPSTASH_REDIS_REST_KV_URL",
    "UPSTASH_REDIS_REST_REDIS_URL"
  ]);
}

function getUpstashToken() {
  return firstEnv([
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_KV_REST_API_READ_ONLY_TOKEN"
  ]);
}

function getQueueKey() {
  return firstEnv(["LFG_QUEUE_KEY"]) || "draxar:lfg:1v1";
}

function clampTtlSeconds(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return 3600;
  }

  return Math.max(60, Math.min(7200, parsed));
}

function normalizeEntry(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const expiresAt = Number(input.expiresAt) || 0;

  return {
    userId: String(input.userId || "").trim(),
    username: String(input.username || "Unknown").trim() || "Unknown",
    guildId: String(input.guildId || "").trim(),
    guildName: String(input.guildName || "").trim(),
    status: String(input.status || "Looking for 1v1").trim() || "Looking for 1v1",
    createdAt: Number(input.createdAt) || Date.now(),
    expiresAt
  };
}

function normalizeEntries(rawEntries) {
  const source = Array.isArray(rawEntries) ? rawEntries : [];
  return source
    .map((entry) => normalizeEntry(entry))
    .filter((entry) => /^\d{8,}$/.test(entry.userId) && entry.expiresAt > 0);
}

async function runCommand(command) {
  const url = getUpstashUrl();
  const token = getUpstashToken();

  if (!url || !token) {
    throw new Error("Missing Upstash env vars. Set REST URL and REST TOKEN in Vercel.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  return response.json();
}

async function loadQueueEntries() {
  const payload = await runCommand(["GET", getQueueKey()]);
  const raw = payload?.result;
  if (!raw || typeof raw !== "string") {
    return [];
  }

  try {
    return normalizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveQueueEntries(entries) {
  const safe = normalizeEntries(entries);
  await runCommand(["SET", getQueueKey(), JSON.stringify(safe)]);
  return safe;
}

function pruneExpiredEntries(entries, now = Date.now()) {
  return normalizeEntries(entries).filter((entry) => entry.expiresAt > now);
}

async function getActiveQueueEntries() {
  const loaded = await loadQueueEntries();
  const active = pruneExpiredEntries(loaded);
  if (active.length !== loaded.length) {
    await saveQueueEntries(active);
  }

  return active.sort((a, b) => b.expiresAt - a.expiresAt);
}

async function upsertQueueEntry(input) {
  const now = Date.now();
  const ttlSeconds = clampTtlSeconds(input?.ttlSeconds);
  const next = {
    userId: String(input?.userId || "").trim(),
    username: String(input?.username || "Unknown").trim() || "Unknown",
    guildId: String(input?.guildId || "").trim(),
    guildName: String(input?.guildName || "").trim(),
    status: String(input?.status || "Looking for 1v1").trim() || "Looking for 1v1",
    createdAt: now,
    expiresAt: now + (ttlSeconds * 1000)
  };

  if (!/^\d{8,}$/.test(next.userId)) {
    throw new Error("Invalid userId");
  }

  const current = await getActiveQueueEntries();
  const merged = current.filter((entry) => entry.userId !== next.userId);
  merged.push(next);

  const saved = await saveQueueEntries(merged);
  return saved.sort((a, b) => b.expiresAt - a.expiresAt);
}

async function removeQueueEntry(userId) {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) {
    return getActiveQueueEntries();
  }

  const current = await getActiveQueueEntries();
  const next = current.filter((entry) => entry.userId !== safeUserId);
  if (next.length === current.length) {
    return current;
  }

  const saved = await saveQueueEntries(next);
  return saved.sort((a, b) => b.expiresAt - a.expiresAt);
}

module.exports = {
  getActiveQueueEntries,
  upsertQueueEntry,
  removeQueueEntry
};
