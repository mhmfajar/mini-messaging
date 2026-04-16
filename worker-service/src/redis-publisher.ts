import Redis from "ioredis";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);

export const REDIS_CHANNELS = {
  MESSAGE_STATUS: "message.status",
  MESSAGE_NEW: "message.new",
} as const;

export interface StatusPayload {
  messageId: string;
  status: string;
  updatedAt: string;
}

export async function publishStatusUpdate(
  messageId: string,
  status: string,
): Promise<void> {
  const payload: StatusPayload = {
    messageId,
    status,
    updatedAt: new Date().toISOString(),
  };

  await redis.publish(REDIS_CHANNELS.MESSAGE_STATUS, JSON.stringify(payload));
  console.log(`[Redis] Published status update for ${messageId}: ${status}`);
}

export async function publishNewMessage(
  message: Record<string, unknown>,
): Promise<void> {
  await redis.publish(REDIS_CHANNELS.MESSAGE_NEW, JSON.stringify(message));
  console.log(`[Redis] Published new message notification for ${message.id}`);
}
