const { EVENT_TYPES } = require("../events");
const { normalizeStatus, STATUS_COLORS } = require("../events/statusColors");

// Extension guide:
// Add a validator function for each new event type and register it in validatePayload.
// Keep each validator focused on one payload contract to avoid coupling between event types.

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeLeaderboardPayload(payload) {
  return {
    group: String(payload.group).trim().toUpperCase(),
    player: String(payload.player).trim(),
    status: normalizeStatus(payload.status),
    score: Number(payload.score),
    matchHighlight: String(payload.matchHighlight).trim()
  };
}

function validateLeaderboardPayload(payload) {
  const errors = [];

  if (!isNonEmptyString(payload.group)) {
    errors.push("group is required and must be a non-empty string");
  }

  if (!isNonEmptyString(payload.player)) {
    errors.push("player is required and must be a non-empty string");
  }

  if (!isNonEmptyString(payload.status)) {
    errors.push("status is required and must be a non-empty string");
  }

  if (!Number.isFinite(Number(payload.score))) {
    errors.push("score is required and must be a valid number");
  }

  if (!isNonEmptyString(payload.matchHighlight)) {
    errors.push("matchHighlight is required and must be a non-empty string");
  }

  const status = normalizeStatus(payload.status);
  if (status && !Object.prototype.hasOwnProperty.call(STATUS_COLORS, status)) {
    errors.push("status must be one of: winner, eliminated, info");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: normalizeLeaderboardPayload(payload)
  };
}

function validateHighlightPayload(payload) {
  // For now highlight events share the same contract as leaderboard updates.
  return validateLeaderboardPayload(payload);
}

function validateSubstitutionPayload(payload) {
  const errors = [];

  if (!isNonEmptyString(payload.group)) {
    errors.push("group is required and must be a non-empty string");
  }

  if (!isNonEmptyString(payload.playerOut)) {
    errors.push("playerOut is required and must be a non-empty string");
  }

  if (!isNonEmptyString(payload.playerIn)) {
    errors.push("playerIn is required and must be a non-empty string");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      group: String(payload.group).trim().toUpperCase(),
      playerOut: String(payload.playerOut).trim(),
      playerIn: String(payload.playerIn).trim(),
      reason: isNonEmptyString(payload.reason) ? String(payload.reason).trim() : ""
    }
  };
}

function validateNotifyPayload(payload) {
  const ids = Array.isArray(payload?.recipientIds)
    ? payload.recipientIds
    : String(payload?.recipientIds || "")
      .split(/[\s,|;]+/)
      .filter(Boolean);

  const recipientIds = [...new Set(ids.map((value) => String(value || "").trim()).filter((value) => /^\d{8,}$/.test(value)))];
  const message = String(payload?.message || "").trim();
  const errors = [];

  if (!recipientIds.length) {
    errors.push("recipientIds is required and must include at least one Discord user ID");
  }

  if (!isNonEmptyString(message)) {
    errors.push("message is required and must be a non-empty string");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      recipientIds,
      message,
      title: isNonEmptyString(payload?.title) ? String(payload.title).trim() : "Ascend Entrenched Broadcast"
    }
  };
}

function validateRuntimeSettingsPayload(payload) {
  return {
    ok: true,
    payload: {
      applicationsPanelChannelId: String(payload?.applicationsPanelChannelId || "").trim(),
      applicationsChannelId: String(payload?.applicationsChannelId || "").trim(),
      notificationUserIds: [...new Set(
        (Array.isArray(payload?.notificationUserIds) ? payload.notificationUserIds : [])
          .map((value) => String(value || "").trim())
          .filter((value) => /^\d{8,}$/.test(value))
      )]
    }
  };
}

function validatePayload(payload, eventType) {
  if (eventType === EVENT_TYPES.HIGHLIGHT) {
    return validateHighlightPayload(payload);
  }

  if (eventType === EVENT_TYPES.SUBSTITUTION) {
    return validateSubstitutionPayload(payload);
  }

  if (eventType === EVENT_TYPES.NOTIFY) {
    return validateNotifyPayload(payload);
  }

  if (eventType === EVENT_TYPES.RUNTIME_SETTINGS) {
    return validateRuntimeSettingsPayload(payload);
  }

  return validateLeaderboardPayload(payload);
}

module.exports = {
  validatePayload
};
