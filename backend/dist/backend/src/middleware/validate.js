"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
/**
 * Middleware factory to validate request body against a Zod schema.
 */
function validate(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const details = {};
                error.errors.forEach((err) => {
                    const key = err.path.join('.');
                    if (!details[key])
                        details[key] = [];
                    details[key].push(err.message);
                });
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                        details,
                    },
                });
                return;
            }
            next(error);
        }
    };
}
//# sourceMappingURL=validate.js.map