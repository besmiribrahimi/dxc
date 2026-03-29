const {
    isGlobalOrderStoreConfigured,
    getGlobalRankingOrder
} = require('../_ranking_store');

function toJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return toJson(res, 405, { error: 'Method Not Allowed' });
    }

    if (!isGlobalOrderStoreConfigured()) {
        return toJson(res, 200, {
            order: [],
            globalSync: false,
            message: 'Global ranking sync backend is not configured'
        });
    }

    try {
        const order = await getGlobalRankingOrder();
        return toJson(res, 200, {
            order,
            globalSync: true
        });
    } catch (error) {
        return toJson(res, 500, {
            error: 'Failed to load global ranking order',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
