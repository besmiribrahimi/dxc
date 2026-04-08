function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function isWebhookEnabled() {
  const raw = firstEnv(["BOT_WEBHOOK_ENABLED"]);
  if (!raw) {
    return true;
  }

  return raw.toLowerCase() !== "false";
}

function getWebhookUrl() {
  return firstEnv(["BOT_WEBHOOK_URL"]);
}

function getWebhookSecret() {
  return firstEnv(["BOT_WEBHOOK_SECRET"]);
}

function getWebhookTimeoutMs() {
  const raw = Number.parseInt(firstEnv(["BOT_WEBHOOK_TIMEOUT_MS"]), 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 7000;
  }

  return raw;
}

function safeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function safeScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(1));
}

async function postBotWebhook(payload) {
  if (!isWebhookEnabled()) {
    return { ok: false, skipped: true, reason: "Webhook disabled" };
  }

  const url = getWebhookUrl();
  if (!url) {
    return { ok: false, skipped: true, reason: "Missing BOT_WEBHOOK_URL" };
  }

  const secret = getWebhookSecret();
  const timeoutMs = getWebhookTimeoutMs();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-webhook-secret": secret } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error || `Webhook failed with status ${response.status}`
      };
    }

    return {
      ok: true,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Webhook request failed"
    };
  } finally {
    clearTimeout(timer);
  }
}

function makeLeaderboardPayload(update) {
  return {
    eventType: "leaderboard",
    group: safeString(update?.group, "GLOBAL"),
    player: safeString(update?.player, "Unknown"),
    status: safeString(update?.status, "info").toLowerCase(),
    score: safeScore(update?.score),
    matchHighlight: safeString(update?.matchHighlight, "Leaderboard updated")
  };
}

function makeHighlightPayload(update) {
  return {
    eventType: "highlight",
    group: safeString(update?.group, "GLOBAL"),
    player: safeString(update?.player, "Unknown"),
    status: safeString(update?.status, "info").toLowerCase(),
    score: safeScore(update?.score),
    matchHighlight: safeString(update?.matchHighlight, "Highlight event")
  };
}

function makeSubstitutionPayload(update) {
  return {
    eventType: "substitution",
    group: safeString(update?.group, "GLOBAL"),
    playerOut: safeString(update?.playerOut, "Unknown"),
    playerIn: safeString(update?.playerIn, "Unknown"),
    reason: safeString(update?.reason, "Leaderboard rotation")
  };
}

function makeNotificationPayload(update) {
  const ids = Array.isArray(update?.recipientIds)
    ? update.recipientIds
    : String(update?.recipientIds || "")
      .split(/[\s,|;]+/)
      .filter(Boolean);

  const recipientIds = [...new Set(ids.map((value) => String(value || "").trim()).filter((value) => /^\d{8,}$/.test(value)))];

  return {
    eventType: "notify",
    title: safeString(update?.title, "Ascend Entrenched Broadcast"),
    message: safeString(update?.message, "Update from Ascend Entrenched"),
    recipientIds
  };
}

function makeRuntimeSettingsPayload(update) {
  return {
    eventType: "runtime_settings",
    applicationsPanelChannelId: safeString(update?.applicationsPanelChannelId),
    applicationsChannelId: safeString(update?.applicationsChannelId),
    notificationUserIds: Array.isArray(update?.notificationUserIds)
      ? [...new Set(update.notificationUserIds.map((value) => String(value || "").trim()).filter((value) => /^\d{8,}$/.test(value)))]
      : []
  };
}

async function sendLeaderboardUpdate(update) {
  return postBotWebhook(makeLeaderboardPayload(update));
}

async function sendMatchHighlight(update) {
  return postBotWebhook(makeHighlightPayload(update));
}

async function sendSubstitution(update) {
  return postBotWebhook(makeSubstitutionPayload(update));
}

async function sendNotificationBroadcast(update) {
  return postBotWebhook(makeNotificationPayload(update));
}

async function sendRuntimeSettings(update) {
  return postBotWebhook(makeRuntimeSettingsPayload(update));
}

module.exports = {
  sendLeaderboardUpdate,
  sendMatchHighlight,
  sendSubstitution,
  sendNotificationBroadcast,
  sendRuntimeSettings
};
