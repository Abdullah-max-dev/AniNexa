const Joi = require("joi");
const { getHomeListing } = require("./home.service");

const homeQuery = Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(15),
});

const getHomeController = async (req, res, next) => {
    const { value, error } = homeQuery.validate(req.query, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details.map((detail) => detail.message).join(", "),
        });
    }

    try {
        const listing = await getHomeListing(value);
        res.set("Cache-Control", "no-store");
        res.json({ success: true, ...listing });
    } catch (requestError) {
        next(requestError);
    }
};

module.exports = { getHomeController };
