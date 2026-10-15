const Joi = require("joi");
const animeService = require("../services/animeService");

const listingQuery = Joi.object({
    page: Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
    limit: Joi.number().integer().min(1).max(20).default(20),
});

const listAnimeController = async (req, res, next) => {
    const { value, error } = listingQuery.validate(req.query, { abortEarly: false });
    if (error || !Number.isSafeInteger((value.page - 1) * value.limit)) {
        return res.status(400).json({
            success: false,
            message: error ? error.details.map((detail) => detail.message).join(", ") : "Page number is too large",
        });
    }
    try {
        const result = await animeService.listAnime(value);
        // Redis is the only cache for this public API response.
        res.set("Cache-Control", "no-store");
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

module.exports = { listAnimeController };
