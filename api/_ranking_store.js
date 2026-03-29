const GLOBAL_RANKING_ORDER_KEY = 'draxar:ranking_order';

function normalizeEnvValue(value) {
    return String(value || '').trim();
}

function getKvConfig() {
    const baseUrl = normalizeEnvValue(
        process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
    );
    const token = normalizeEnvValue(
        process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    );

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
        return [];
    }

    const rawValue = await runKvCommand('get', [GLOBAL_RANKING_ORDER_KEY]);
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((value) => String(value || '').trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function setGlobalRankingOrder(orderUsernames) {
    if (!isGlobalOrderStoreConfigured()) {
        throw new Error('KV/Redis REST is not configured');
    }

    const sanitizedOrder = Array.from(new Set(
        (Array.isArray(orderUsernames) ? orderUsernames : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    const payload = JSON.stringify(sanitizedOrder);
    await runKvCommand('set', [GLOBAL_RANKING_ORDER_KEY, payload]);
    return sanitizedOrder;
}

module.exports = {
    isGlobalOrderStoreConfigured,
    getGlobalRankingOrder,
    setGlobalRankingOrder
};
