import { prisma } from "../../lib/prisma";

export interface IPushMessagePayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  channelId?: "default" | "messages" | "calls";
  priority?: "default" | "normal" | "high";
  badge?: number;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Sends one or multiple push notifications via Expo Push Service using native fetch
 */
export const sendExpoPushNotification = async (
  messages: IPushMessagePayload[]
): Promise<void> => {
  if (!messages || messages.length === 0) return;

  // Filter valid Expo push tokens
  const validMessages = messages.filter(
    (m) =>
      typeof m.to === "string" &&
      (m.to.startsWith("ExponentPushToken") || m.to.startsWith("ExpoPushToken"))
  );

  if (validMessages.length === 0) return;

  try {
    const payload = validMessages.map((m) => ({
      to: m.to,
      title: m.title,
      body: m.body,
      data: m.data || {},
      sound: m.sound || "default",
      channelId: m.channelId || "default",
      priority: m.priority || "high",
      badge: m.badge,
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("[PushService] Failed response from Expo push service:", errText);
    }
  } catch (err: any) {
    console.warn("[PushService] Failed to send push notification:", err?.message);
  }
};

/**
 * Sends a push notification to a specific user by their User ID
 */
export const sendPushToUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  options?: {
    channelId?: "default" | "messages" | "calls";
    sound?: string;
    priority?: "default" | "normal" | "high";
  }
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) return;

    await sendExpoPushNotification([
      {
        to: user.pushToken,
        title,
        body,
        data,
        channelId: options?.channelId || "default",
        sound: options?.sound || "default",
        priority: options?.priority || "high",
      },
    ]);
  } catch (err: any) {
    console.warn(`[PushService] Failed to send push to user ${userId}:`, err?.message);
  }
};

/**
 * Sends push notifications to multiple users by their User IDs
 */
export const sendPushToUsers = async (
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  options?: {
    channelId?: "default" | "messages" | "calls";
    sound?: string;
    priority?: "default" | "normal" | "high";
  }
): Promise<void> => {
  if (!userIds || userIds.length === 0) return;

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });

    const messages: IPushMessagePayload[] = users
      .filter((u) => !!u.pushToken)
      .map((u) => ({
        to: u.pushToken!,
        title,
        body,
        data,
        channelId: options?.channelId || "default",
        sound: options?.sound || "default",
        priority: options?.priority || "high",
      }));

    if (messages.length > 0) {
      await sendExpoPushNotification(messages);
    }
  } catch (err: any) {
    console.warn("[PushService] Failed to send push to users:", err?.message);
  }
};
