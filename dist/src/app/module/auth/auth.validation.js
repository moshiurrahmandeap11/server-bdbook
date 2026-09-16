import { z } from "zod";
const signupValidationSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    fullName: z.string().min(2, "Full name must be at least 2 characters long"),
    gender: z.enum(["male", "female", "other"]).optional(),
    dob: z.string().or(z.date()).optional(),
});
const loginValidationSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});
export const authValidation = {
    signupValidationSchema,
    loginValidationSchema,
};
