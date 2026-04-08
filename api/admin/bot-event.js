const { parseJsonBody, requireAdmin, sendJson } = require("../_lib/auth");
const {
  sendLeaderboardUpdate,
  sendMatchHighlight,
  sendSubstitution
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
