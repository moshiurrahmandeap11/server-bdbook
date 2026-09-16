import status from "http-status";
export const notFound = (req, res) => {
    res.status(status.NOT_FOUND).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        errorSources: [
            {
                path: req.originalUrl,
                message: "API endpoint does not exist",
            },
        ],
    });
};
