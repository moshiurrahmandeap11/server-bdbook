import { z } from "zod";

const createPostValidationSchema = z.object({
  description: z.string().optional(),
});

const editPostValidationSchema = z.object({
  description: z.string().min(1, "Description cannot be empty"),
});

const commentValidationSchema = z.object({
  text: z.string().min(1, "Comment text is required"),
  parentCommentId: z.string().optional(),
});

export const postValidation = {
  createPostValidationSchema,
  editPostValidationSchema,
  commentValidationSchema,
};

