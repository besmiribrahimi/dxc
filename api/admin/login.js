const {
    toJson,
    getAuthSecret,
    getAdminPassword,
    safeCompare,
    issueSessionToken,
    setSessionCookie,
    parseJsonBody
} = require("./_auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return toJson(res, 405, { error: "Method Not Allowed" });
    }

    const adminPassword = getAdminPassword();
    const secret = getAuthSecret();
    if (!adminPassword || !secret) {
        return toJson(res, 500, { error: "Admin auth is not configured" });
    }

    let body = {};
    try {
        body = await parseJsonBody(req);
    } catch (error) {
        return toJson(res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }

    const password = String(body.password || "").trim();
    if (!safeCompare(password, adminPassword)) {
        return toJson(res, 401, { error: "Invalid admin password" });
    }

    const token = issueSessionToken(secret);
    setSessionCookie(res, token);

    return toJson(res, 200, { authenticated: true });
};
