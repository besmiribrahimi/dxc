const {
    toJson,
    getAuthSecret,
    isAuthenticatedRequest
} = require("./_auth");

module.exports = function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return toJson(res, 405, { error: "Method Not Allowed" });
    }

    const secret = getAuthSecret();
    if (!secret) {
        return toJson(res, 500, { error: "Admin auth is not configured" });
    }

    return toJson(res, 200, {
        authenticated: isAuthenticatedRequest(req, secret)
    });
};
