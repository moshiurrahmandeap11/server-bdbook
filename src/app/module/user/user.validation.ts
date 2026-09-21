import { z } from "zod";

const updateUserValidationSchema = z.object({
  fullName: z.string().min(1, "Full name is required").optional(),
  gender: z.enum(["male", "female", "other"]).optional().nullable().or(z.literal("")),
  dob: z.string().or(z.date()).optional().nullable().or(z.literal("")),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional().nullable().or(z.literal("")),
  location: z.string().max(100).optional().nullable().or(z.literal("")),
  website: z.string().max(255).optional().nullable().or(z.literal("")),
});

const changePasswordValidationSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});

export const userValidation = {
  updateUserValidationSchema,
  changePasswordValidationSchema,
};

