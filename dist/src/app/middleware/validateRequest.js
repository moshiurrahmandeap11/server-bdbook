export const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            if (req.body?.data && typeof req.body.data === "string") {
                try {
                    req.body = JSON.parse(req.body.data);
                }
                catch {
                    // ignore if parsing fails
                }
            }
            await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
