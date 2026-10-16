const Joi = require("joi");

const registerSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z\s]+$/)
        .required()
        .messages({
            "string.empty": "Name is required",
            "string.min": "Name must be at least 2 characters",
            "string.max": "Name cannot exceed 50 characters",
            "string.pattern.base": "Name can only contain letters and spaces",
            "any.required": "Name is required",
        }),

    email: Joi.string()
        .trim()
        .email()
        .lowercase()
        .required()
        .messages({
            "string.empty": "Email is required",
            "string.email": "Please enter a valid email",
            "any.required": "Email is required",
        }),

    password: Joi.string()
        .min(8)
        .max(72)
        .pattern(/[A-Z]/)
        .pattern(/[a-z]/)
        .pattern(/[0-9]/)
        .required()
        .messages({
            "string.empty": "Password is required",
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password cannot exceed 72 characters",
            "string.pattern.base":
                "Password must contain uppercase, lowercase, and a number",
            "any.required": "Password is required",
        }),

    confirmPassword: Joi.any()
        .valid(Joi.ref("password"))
        .required()
        .messages({
            "any.only": "Passwords do not match",
            "any.required": "Confirm password is required",
        }),
});

const loginSchema = Joi.object({
    deviceIp: Joi.string().trim().ip({ version: ["ipv4", "ipv6"], cidr: "forbidden" }).allow(null).optional(),
    email: Joi.string()
        .trim()
        .email()
        .lowercase()
        .required()
        .messages({
            "string.empty": "Email is required",
            "string.email": "Please enter a valid email",
            "any.required": "Email is required",
        }),

    password: Joi.string()
        .required()
        .messages({
            "string.empty": "Password is required",
            "any.required": "Password is required",
        }),
});

const validateRegister = (req, res, next) => {
    const { error, value } = registerSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(422).json({
            success: false,
            message: "Validation failed",
            errors: error.details.map((detail) => ({
                field: detail.path[0],
                message: detail.message,
            })),
        });
    }

    req.body = value;
    next();
};

const validateLogin = (req, res, next) => {
    const { error, value } = loginSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(422).json({
            success: false,
            message: "Validation failed",
            errors: error.details.map((detail) => ({
                field: detail.path[0],
                message: detail.message,
            })),
        });
    }

    req.body = value;
    next();
};

module.exports = {
    validateRegister,
    validateLogin,
};
