const crypto = require("crypto");
const TEMP_ADMIN_PASSWORD_DEFAULT = "draxar-test-123";

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).trim();
      }

      return trimmed;
    }
  }

  return "";
}

function getAdminPassword() {
  return firstEnv(["ADMIN_PANEL_PASSWORD"]);
}

function isProductionEnvironment() {
  const env = firstEnv(["VERCEL_ENV", "NODE_ENV"]).toLowerCase();
  return env === "production";
}

function getAdminTestPassword() {
  const explicit = firstEnv(["ADMIN_PANEL_TEST_PASSWORD"]);
  if (explicit) {
    return explicit;
  }

  if (isProductionEnvironment()) {
    return "";
  }

  return TEMP_ADMIN_PASSWORD_DEFAULT;
}

function getAdminSecret() {
  return firstEnv(["ADMIN_PANEL_SECRET", "WEBSITE_API_TOKEN"]);
}

function parseJsonBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = String(input)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

function createAdminToken(expiresInSeconds = 60 * 60 * 24) {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error("Missing ADMIN_PANEL_SECRET env var.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: "admin",
    iat: now,
    exp: now + Math.max(60, Number(expiresInSeconds) || 0)
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${encodedPayload}.${signature}`;
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const raw = String(header);
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return raw.slice(7).trim();
}

function verifyAdminToken(token) {
  const secret = getAdminSecret();
  if (!secret || !token) {
    return false;
  }

  const [encodedPayload, signature] = String(token).split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (payload?.role !== "admin") {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return Number(payload?.exp) > now;
  } catch {
    return false;
  }
}

function sendJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.status(status).json(data);
}

function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!verifyAdminToken(token)) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return false;
  }

  return true;
}

module.exports = {
  createAdminToken,
  getAdminPassword,
  getAdminTestPassword,
  parseJsonBody,
  requireAdmin,
  sendJson
};
