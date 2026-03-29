const {
    toJson,
    clearSessionCookie
} = require("./_auth");

module.exports = function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return toJson(res, 405, { error: "Method Not Allowed" });
    }

    clearSessionCookie(res);
    return toJson(res, 200, { authenticated: false });
};
