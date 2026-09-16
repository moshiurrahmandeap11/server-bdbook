import status from "http-status";
export const handleZodError = (err) => {
    const statusCode = status.BAD_REQUEST;
    const message = "Validation Error";
    const errorSources = err.issues.map((issue) => ({
        path: issue.path.join(" => "),
        message: issue.message,
    }));
    return {
        statusCode,
        success: false,
        message,
        errorSources,
    };
};
