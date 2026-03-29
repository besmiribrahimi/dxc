const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PLAYER_DATA_REGEX = /const\s+playerData\s*=\s*(\[[\s\S]*?\]);/;
const SCRIPT_PATH = path.join(process.cwd(), "script.js");

function toJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

function getHeaderToken(req) {
    const headerValue = req.headers["x-bot-token"];
    if (Array.isArray(headerValue)) {
        return headerValue[0] || "";
    }
    return headerValue || "";
}

function parsePlayerData(scriptSource) {
    const match = scriptSource.match(PLAYER_DATA_REGEX);
    if (!match) {
        throw new Error("Could not find playerData array in script.js");
    }

    const arrayLiteral = match[1];
    const parsed = vm.runInNewContext(`(${arrayLiteral})`, {}, { timeout: 500 });

    if (!Array.isArray(parsed)) {
        throw new Error("playerData is not an array");
    }

    return parsed;
}

function loadPlayerData(scriptPath) {
    const source = fs.readFileSync(scriptPath, "utf8");
    return parsePlayerData(source);
}

function computeStats(players) {
    const factions = new Set(
        players
            .map((player) => String(player?.faction || "").trim())
            .filter(Boolean)
    );

    const countries = new Set(
        players
            .map((player) => String(player?.country || "").trim())
            .filter(Boolean)
    );

    return {
        players: players.length,
        factions: factions.size,
        countries: countries.size
    };
}

module.exports = function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return toJson(res, 405, { error: "Method Not Allowed" });
    }

    const expectedToken = process.env.WEBSITE_API_TOKEN;
    if (!expectedToken) {
        return toJson(res, 500, { error: "WEBSITE_API_TOKEN is not configured" });
    }

    const incomingToken = getHeaderToken(req);
    if (!incomingToken || incomingToken !== expectedToken) {
        return toJson(res, 401, { error: "Unauthorized" });
    }

    try {
        const players = loadPlayerData(SCRIPT_PATH);
        const { players: playerCount, factions, countries } = computeStats(players);
        const updatedAt = fs.statSync(SCRIPT_PATH).mtime.toISOString();

        return toJson(res, 200, {
            players: playerCount,
            factions,
            countries,
            updatedAt
        });
    } catch (error) {
        return toJson(res, 500, {
            error: "Failed to load website stats",
            detail: error instanceof Error ? error.message : "Unknown error"
        });
    }
};