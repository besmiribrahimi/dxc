const {
    toJson,
    getAuthSecret,
    isAuthenticatedRequest,
    parseJsonBody
} = require('./_auth');
const {
    isGlobalOrderStoreConfigured,
    setGlobalRankingOrder
} = require('../_ranking_store');

module.exports = async function handler(req, res) {
    if (req.method !== 'PUT') {
        res.setHeader('Allow', 'PUT');
        return toJson(res, 405, { error: 'Method Not Allowed' });
    }

    const authSecret = getAuthSecret();
    if (!authSecret) {
        return toJson(res, 500, { error: 'Admin auth is not configured' });
    }

    if (!isAuthenticatedRequest(req, authSecret)) {
        return toJson(res, 401, { error: 'Unauthorized' });
    }

    if (!isGlobalOrderStoreConfigured()) {
        return toJson(res, 503, { error: 'Global sync is not configured (missing KV/Redis REST env vars)' });
    }

    let body = {};
    try {
        body = await parseJsonBody(req);
    } catch (error) {
        return toJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid request body' });
    }

    const order = Array.isArray(body.order) ? body.order : [];
    if (!order.length) {
        return toJson(res, 400, { error: 'order must be a non-empty array' });
    }

    try {
        const savedOrder = await setGlobalRankingOrder(order);
        return toJson(res, 200, {
            ok: true,
            count: savedOrder.length,
            order: savedOrder
        });
    } catch (error) {
        return toJson(res, 500, {
            error: 'Failed to save global ranking order',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
