import { z } from "zod";

const signupValidationSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    fullName: z.string().min(2, "Full name must be at least 2 characters long").optional(),
    name: z.string().min(2).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    dob: z.string().or(z.date()).optional(),
  })
  .refine((data) => Boolean(data.fullName || data.name), {
    message: "Full name is required",
    path: ["fullName"],
  });

const loginValidationSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const authValidation = {
  signupValidationSchema,
  loginValidationSchema,
};
