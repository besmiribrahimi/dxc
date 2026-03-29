const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {
    isGlobalOrderStoreConfigured,
    getGlobalRankingOrder
} = require("../_ranking_store");

const PLAYER_DATA_REGEX = /const\s+playerData\s*=\s*(\[[\s\S]*?\]);/;

function resolveScriptPath() {
    const candidates = [
        path.join(process.cwd(), "script.js"),
        path.resolve(__dirname, "..", "..", "script.js")
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Keep previous behavior as a fallback for environments where existence checks fail.
    return path.join(process.cwd(), "script.js");
}

const SCRIPT_PATH = resolveScriptPath();

function toJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
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

function normalizeLabel(value) {
    const text = String(value || "").trim();
    return text || "N/A";
}

function normalizeUsername(value) {
    return String(value || "").trim();
}

function normalizeLevel(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(1, Math.min(10, parsed));
}

function applyGlobalRankingState(players, rankingState) {
    const sourcePlayers = Array.isArray(players) ? players : [];
    const order = Array.isArray(rankingState?.order) ? rankingState.order : [];
    const levels = rankingState?.levels && typeof rankingState.levels === "object"
        ? rankingState.levels
        : {};

    const byUsername = new Map();
    for (const player of sourcePlayers) {
        const username = normalizeUsername(player?.username);
        if (!username || byUsername.has(username)) {
            continue;
        }

        byUsername.set(username, { ...player, username });
    }

    const seen = new Set();
    const orderedPlayers = [];

    for (const usernameValue of order) {
        const username = normalizeUsername(usernameValue);
        if (!username || seen.has(username) || !byUsername.has(username)) {
            continue;
        }

        seen.add(username);
        orderedPlayers.push(byUsername.get(username));
    }

    for (const player of sourcePlayers) {
        const username = normalizeUsername(player?.username);
        if (!username || seen.has(username)) {
            continue;
        }

        seen.add(username);
        orderedPlayers.push({ ...player, username });
    }

    return orderedPlayers.map((player) => {
        const username = normalizeUsername(player?.username);
        const level = normalizeLevel(levels[username]);
        return {
            ...player,
            username,
            ...(level ? { level } : {})
        };
    });
}

function buildTopCounts(players, fieldName, limit = 5) {
    const counts = new Map();

    for (const player of players) {
        const key = normalizeLabel(player?.[fieldName]);
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));
}

function buildTopPlayers(players, limit = 10) {
    return players.slice(0, limit).map((player, index) => ({
        rank: index + 1,
        username: normalizeLabel(player?.username),
        faction: normalizeLabel(player?.faction),
        country: normalizeLabel(player?.country),
        level: Number.isFinite(Number(player?.level)) ? Number(player.level) : null
    }));
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
        countries: countries.size,
        topPlayers: buildTopPlayers(players, 10),
        topFactions: buildTopCounts(players, "faction", 5),
        topCountries: buildTopCounts(players, "country", 5)
    };
}

module.exports = async function handler(req, res) {
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
        const playersFromScript = loadPlayerData(SCRIPT_PATH);
        let players = playersFromScript;
        let rankingSource = "script";

        if (isGlobalOrderStoreConfigured()) {
            try {
                const rankingState = await getGlobalRankingOrder();
                players = applyGlobalRankingState(playersFromScript, rankingState);
                if (Array.isArray(rankingState?.order) && rankingState.order.length > 0) {
                    rankingSource = "global-order";
                }
            } catch {
                // Keep script order when global order lookup fails.
                players = playersFromScript;
            }
        }

        const {
            players: playerCount,
            factions,
            countries,
            topPlayers,
            topFactions,
            topCountries
        } = computeStats(players);
        const updatedAt = fs.statSync(SCRIPT_PATH).mtime.toISOString();

        return toJson(res, 200, {
            players: playerCount,
            factions,
            countries,
            topPlayers,
            topFactions,
            topCountries,
            rankingSource,
            updatedAt
        });
    
    } catch (error) {
        return toJson(res, 500, {
            error: "Failed to load website stats",
            detail: error instanceof Error ? error.message : "Unknown error"
        });
    }
};