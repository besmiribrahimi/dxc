const { parseJsonBody, requireAdmin, sendJson } = require("../_lib/auth");
const {
  sendLeaderboardUpdate,
  sendMatchHighlight,
  sendSubstitution,
  sendNotificationBroadcast,
  sendRuntimeSettings
} = require("../_lib/bot-webhook");

function normalizeType(value) {
  return String(value || "leaderboard").trim().toLowerCase();
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateLeaderboardPayload(payload) {
  const errors = [];
  if (!hasText(payload.group)) {
    errors.push("group is required");
  }
  if (!hasText(payload.player)) {
    errors.push("player is required");
  }
  if (!hasText(payload.status)) {
    errors.push("status is required");
  }
  if (!Number.isFinite(Number(payload.score))) {
    errors.push("score is required and must be numeric");
  }
  if (!hasText(payload.matchHighlight)) {
    errors.push("matchHighlight is required");
  }

  return errors;
}

function validateSubstitutionPayload(payload) {
  const errors = [];
  if (!hasText(payload.group)) {
    errors.push("group is required");
  }
  if (!hasText(payload.playerOut)) {
    errors.push("playerOut is required");
  }
  if (!hasText(payload.playerIn)) {
    errors.push("playerIn is required");
  }
  return errors;
}

function validateNotifyPayload(payload) {
  const errors = [];
  const ids = Array.isArray(payload?.recipientIds)
    ? payload.recipientIds
    : String(payload?.recipientIds || "")
      .split(/[\s,|;]+/)
      .filter(Boolean);

  const recipientIds = [...new Set(
    ids
      .map((value) => String(value || "").trim().replace(/[<@!>]/g, ""))
      .filter((value) => /^\d{8,}$/.test(value))
  )];

  if (!recipientIds.length) {
    errors.push("recipientIds is required");
  }

  if (!hasText(payload?.message)) {
    errors.push("message is required");
  }

  return errors;
}

function validateRuntimeSettingsPayload(payload) {
  const errors = [];
  const panel = String(payload?.applicationsPanelChannelId || "").trim();
  const intake = String(payload?.applicationsChannelId || "").trim();

  if (panel && !/^\d{8,}$/.test(panel)) {
    errors.push("applicationsPanelChannelId must be a Discord channel ID");
  }

  if (intake && !/^\d{8,}$/.test(intake)) {
    errors.push("applicationsChannelId must be a Discord channel ID");
  }

  return errors;
}

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = parseJsonBody(req);
  const type = normalizeType(body?.eventType);

  let errors = [];
  if (type === "substitution") {
    errors = validateSubstitutionPayload(body);
  } else if (type === "notify" || type === "notification" || type === "broadcast") {
    errors = validateNotifyPayload(body);
  } else if (type === "runtime_settings" || type === "runtime" || type === "settings_sync") {
    errors = validateRuntimeSettingsPayload(body);
  } else {
    errors = validateLeaderboardPayload(body);
  }

  if (errors.length > 0) {
    return sendJson(res, 400, { ok: false, error: "Invalid payload", details: errors });
  }

  try {
    let result;

    if (type === "substitution") {
      result = await sendSubstitution(body);
    } else if (type === "notify" || type === "notification" || type === "broadcast") {
      result = await sendNotificationBroadcast(body);
    } else if (type === "runtime_settings" || type === "runtime" || type === "settings_sync") {
      result = await sendRuntimeSettings(body);
    } else if (type === "highlight") {
      result = await sendMatchHighlight(body);
    } else {
      result = await sendLeaderboardUpdate(body);
    }

    if (!result?.ok && !result?.skipped) {
      return sendJson(res, 502, {
        ok: false,
        error: result?.error || "Failed to dispatch event to bot"
      });
    }

    if (result?.skipped) {
      return sendJson(res, 503, {
        ok: false,
        error: result?.reason || "Bot webhook is disabled or not configured"
      });
    }

    return sendJson(res, 200, {
      ok: true,
      eventType: type,
      dispatch: result
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to dispatch bot event"
    });
  }
};
