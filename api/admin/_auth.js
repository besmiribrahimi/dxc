const crypto = require("crypto");

const SESSION_COOKIE_NAME = "draxar_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function normalizeEnvValue(value) {
    return String(value || "").trim();
}

function toJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
}

function getAuthSecret() {
    return normalizeEnvValue(
        process.env.ADMIN_PANEL_SECRET
        || process.env.ADMIN_SECRET
        || process.env.WEBSITE_API_TOKEN
    );
}

function getAdminPassword() {
    return normalizeEnvValue(
        process.env.ADMIN_PANEL_PASSWORD
        || process.env.ADMIN_PASSWORD
        || process.env.WEBSITE_API_TOKEN
    );
}

function safeCompare(input, expected) {
    if (typeof input !== "string" || typeof expected !== "string") return false;
    const inputBuffer = Buffer.from(input);
    const expectedBuffer = Buffer.from(expected);
    if (inputBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

function parseCookies(cookieHeader = "") {
    return String(cookieHeader)
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const separatorIndex = part.indexOf("=");
            if (separatorIndex < 0) return acc;
            const key = part.slice(0, separatorIndex).trim();
            const value = decodeURIComponent(part.slice(separatorIndex + 1));
            if (key) acc[key] = value;
            return acc;
        }, {});
}

function encodeBase64Url(value) {
    return Buffer.from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const missingPadding = padded.length % 4;
    const normalized = missingPadding ? padded + "=".repeat(4 - missingPadding) : padded;
    return Buffer.from(normalized, "base64").toString("utf8");
}

function signData(data, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function issueSessionToken(secret) {
    const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    };

    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = signData(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, secret) {
    if (!token || !secret || !token.includes(".")) return false;

    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;

    const expectedSignature = signData(encodedPayload, secret);
    if (!safeCompare(signature, expectedSignature)) return false;

    try {
        const payload = JSON.parse(decodeBase64Url(encodedPayload));
        const exp = Number(payload.exp || 0);
        return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

function setSessionCookie(res, token) {
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`;
    res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookie = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
    res.setHeader("Set-Cookie", cookie);
}

function isAuthenticatedRequest(req, secret) {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE_NAME] || "";
    return verifySessionToken(token, secret);
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";

        req.on("data", (chunk) => {
            raw += chunk;
            if (raw.length > 1024 * 32) {
                reject(new Error("Request body too large"));
            }
        });

        req.on("end", () => {
            if (!raw) {
                resolve({});
                return;
            }

            try {
                const parsed = JSON.parse(raw);
                resolve(parsed && typeof parsed === "object" ? parsed : {});
            } catch {
                reject(new Error("Invalid JSON body"));
            }
        });

        req.on("error", () => reject(new Error("Failed to read request body")));
    });
}

module.exports = {
    toJson,
    getAuthSecret,
    getAdminPassword,
    safeCompare,
    issueSessionToken,
    setSessionCookie,
    clearSessionCookie,
    isAuthenticatedRequest,
    parseJsonBody
};
