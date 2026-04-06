const {
  createAdminToken,
  getAdminPassword,
  getAdminTestPassword,
  parseJsonBody,
  sendJson
} = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const adminPassword = getAdminPassword();
  const testPassword = getAdminTestPassword();
  if (!adminPassword && !testPassword) {
    return sendJson(res, 500, {
      ok: false,
      error: "Missing ADMIN_PANEL_PASSWORD env var"
    });
  }

  const body = parseJsonBody(req);
  const password = String(body?.password || "");

  const isPrimaryMatch = Boolean(adminPassword) && password === adminPassword;
  const isTestMatch = Boolean(testPassword) && password === testPassword;
  if (!password || (!isPrimaryMatch && !isTestMatch)) {
    return sendJson(res, 401, { ok: false, error: "Invalid password" });
  }

  try {
    const token = createAdminToken();
    return sendJson(res, 200, {
      ok: true,
      token,
      expiresIn: 86400
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create token"
    });
  }
};
