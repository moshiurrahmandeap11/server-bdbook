import { z } from "zod";

const sendMessageValidationSchema = z
  .object({
    message: z.string().optional(),
    messageType: z.enum(["text", "image", "video", "file", "share"]).optional(),
    mediaUrl: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
    fileSize: z.number().optional().nullable(),
    tempId: z.string().optional().nullable(),
  })
  .refine((data) => (data.message && data.message.trim().length > 0) || data.mediaUrl, {
    message: "Message content or media is required",
  });

export const messageValidation = {
  sendMessageValidationSchema,
};

