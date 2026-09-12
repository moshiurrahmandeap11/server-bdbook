import { z } from "zod";

const updateUserValidationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters long").optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dob: z.string().or(z.date()).optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  location: z.string().max(100).optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
});

const changePasswordValidationSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});

export const userValidation = {
  updateUserValidationSchema,
  changePasswordValidationSchema,
};

