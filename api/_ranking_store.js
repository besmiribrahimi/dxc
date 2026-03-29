const GLOBAL_RANKING_ORDER_KEY = 'draxar:ranking_order';

function normalizeEnvValue(value) {
    return String(value || '').trim();
}

function pickFirstEnvValue(keys) {
    for (const key of keys) {
        const value = normalizeEnvValue(process.env[key]);
        if (value) return value;
    }
    return '';
}

function findBySuffix(suffixes) {
    const entries = Object.entries(process.env || {});
    for (const [key, rawValue] of entries) {
        const upperKey = String(key || '').toUpperCase();
        if (!suffixes.some((suffix) => upperKey.endsWith(suffix))) continue;

        const value = normalizeEnvValue(rawValue);
        if (value) return value;
    }
    return '';
}

function getKvConfig() {
    const baseUrl = pickFirstEnvValue([
        'KV_REST_API_URL',
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_KV_REST_API_URL',
        'UPSTASH_REDIS_REST_REDIS_URL',
        'UPSTASH_REDIS_REST_KV_URL'
    ]) || findBySuffix([
        'KV_REST_API_URL',
        'UPSTASH_REDIS_REST_URL',
        'REDIS_URL',
        'KV_URL'
    ]);

    const token = pickFirstEnvValue([
        'KV_REST_API_TOKEN',
        'UPSTASH_REDIS_REST_TOKEN',
        'UPSTASH_REDIS_REST_KV_REST_API_TOKEN',
        'UPSTASH_REDIS_REST_KV_REST_API_READ_ONLY_TOKEN'
    ]) || findBySuffix([
        'KV_REST_API_TOKEN',
        'UPSTASH_REDIS_REST_TOKEN',
        'KV_REST_API_READ_ONLY_TOKEN',
        'READ_ONLY_TOKEN'
    ]);

    return {
        baseUrl,
        token,
        configured: Boolean(baseUrl && token)
    };
}

function isGlobalOrderStoreConfigured() {
    return getKvConfig().configured;
}

async function runKvCommand(command, args = []) {
    const { baseUrl, token, configured } = getKvConfig();
    if (!configured) {
        throw new Error('KV/Redis REST is not configured');
    }

    const commandPath = [command, ...args]
        .map((value) => encodeURIComponent(String(value)))
        .join('/');

    const response = await fetch(`${baseUrl}/${commandPath}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        const detail = typeof payload?.error === 'string' ? payload.error : `KV request failed with status ${response.status}`;
        throw new Error(detail);
    }

    return payload.result;
}

async function getGlobalRankingOrder() {
    if (!isGlobalOrderStoreConfigured()) {
        return { order: [], levels: {} };
    }

    const rawValue = await runKvCommand('get', [GLOBAL_RANKING_ORDER_KEY]);
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return { order: [], levels: {} };
    }

    try {
        const parsed = JSON.parse(rawValue);
        const sanitizeOrder = (value) => Array.from(new Set(
            (Array.isArray(value) ? value : [])
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
        ));

        const sanitizeLevels = (value, allowedUsernames) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return {};
            }

            const allowedSet = new Set(allowedUsernames);
            const entries = Object.entries(value)
                .map(([username, level]) => {
                    const safeUsername = String(username || '').trim();
                    const parsedLevel = Number.parseInt(String(level ?? ''), 10);
                    const safeLevel = Number.isFinite(parsedLevel)
                        ? Math.max(1, Math.min(10, parsedLevel))
                        : 0;
                    return [safeUsername, safeLevel];
                })
                .filter(([username, level]) => Boolean(username) && level > 0 && allowedSet.has(username));

            return Object.fromEntries(entries);
        };

        if (Array.isArray(parsed)) {
            return {
                order: sanitizeOrder(parsed),
                levels: {}
            };
        }

        if (!parsed || typeof parsed !== 'object') {
            return { order: [], levels: {} };
        }

        const order = sanitizeOrder(parsed.order);
        const levels = sanitizeLevels(parsed.levels, order);

        return { order, levels };
    } catch {
        return { order: [], levels: {} };
    }
}

async function setGlobalRankingOrder(orderUsernames, levelMap = {}) {
    if (!isGlobalOrderStoreConfigured()) {
        throw new Error('KV/Redis REST is not configured');
    }

    const sanitizedOrder = Array.from(new Set(
        (Array.isArray(orderUsernames) ? orderUsernames : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    const allowedSet = new Set(sanitizedOrder);
    const sanitizedLevels = Object.fromEntries(
        Object.entries(levelMap && typeof levelMap === 'object' && !Array.isArray(levelMap) ? levelMap : {})
            .map(([username, level]) => {
                const safeUsername = String(username || '').trim();
                const parsedLevel = Number.parseInt(String(level ?? ''), 10);
                const safeLevel = Number.isFinite(parsedLevel)
                    ? Math.max(1, Math.min(10, parsedLevel))
                    : 0;
                return [safeUsername, safeLevel];
            })
            .filter(([username, level]) => Boolean(username) && level > 0 && allowedSet.has(username))
    );

    const payload = JSON.stringify({
        order: sanitizedOrder,
        levels: sanitizedLevels
    });
    await runKvCommand('set', [GLOBAL_RANKING_ORDER_KEY, payload]);
    return {
        order: sanitizedOrder,
        levels: sanitizedLevels
    };
}

module.exports = {
    isGlobalOrderStoreConfigured,
    getGlobalRankingOrder,
    setGlobalRankingOrder
};
