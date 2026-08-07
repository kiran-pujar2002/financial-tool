// middleware/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const cacheMiddleware = (duration = 300) => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const key = req.originalUrl;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            return res.json(cachedResponse);
        }

        // Store original send function
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            cache.set(key, body, duration);
            originalJson(body);
        };

        next();
    };
};

module.exports = { cacheMiddleware, cache };