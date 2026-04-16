import amqp, { type ConsumeMessage } from "amqplib";
import { processMessage } from "./processor";
import { prisma } from "./prisma";
import { MessageStatus } from "@prisma/client";
import { publishStatusUpdate } from "./redis-publisher";
import "dotenv/config";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

const QUEUE_NAME = "messages.send";
const DLQ_NAME = "messages.send.dlq";
const MAX_RETRIES = 3;

/**
 * Extracts the retry count from the x-death header set by RabbitMQ
 * when a message is dead-lettered and re-routed.
 */
function getRetryCount(msg: ConsumeMessage): number {
  const xDeath = msg.properties.headers?.["x-death"];
  if (Array.isArray(xDeath) && xDeath.length > 0) {
    return (xDeath[0]?.count as number) || 0;
  }
  return 0;
}

export async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Declare DLQ first (messages land here on NACK without requeue)
    await channel.assertQueue(DLQ_NAME, {
      durable: true,
    });

    // Main queue — dead-letters to DLQ on rejection
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": DLQ_NAME,
      },
    });

    // Prefetch to avoid overwhelming the worker
    channel.prefetch(5);

    console.log(
      `[*] Worker waiting for messages in ${QUEUE_NAME} (DLQ: ${DLQ_NAME}, max retries: ${MAX_RETRIES})`,
    );

    // ── Main queue consumer ─────────────────────────────────────
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg === null) return;

      const content = JSON.parse(msg.content.toString());
      // NestJS ClientProxy format: { pattern: 'message.send', data: { id, ... } }
      const { data } = content;

      try {
        await processMessage(data);
        channel.ack(msg);
      } catch (error) {
        console.error(
          `[Consumer] Failed to process message ${data?.id}, sending to DLQ...`,
        );
        // NACK without requeue — RabbitMQ routes to DLQ via x-dead-letter config
        channel.nack(msg, false, false);
      }
    });

    // ── DLQ consumer — retry or permanently fail ────────────────
    channel.consume(DLQ_NAME, async (msg) => {
      if (msg === null) return;

      const content = JSON.parse(msg.content.toString());
      const { data } = content;
      const retryCount = getRetryCount(msg) + 1;

      if (retryCount <= MAX_RETRIES) {
        console.log(
          `[DLQ] Retrying message ${data?.id} (attempt ${retryCount}/${MAX_RETRIES})...`,
        );

        // Wait before retry (exponential-ish backoff)
        await new Promise((resolve) => setTimeout(resolve, retryCount * 2000));

        // Re-publish to main queue for another attempt
        channel.sendToQueue(QUEUE_NAME, msg.content, {
          persistent: true,
          headers: {
            ...msg.properties.headers,
            "x-death": [{ count: retryCount }],
          },
        });
        channel.ack(msg);
      } else {
        // Max retries exceeded — mark as permanently failed
        console.error(
          `[DLQ] Message ${data?.id} failed after ${MAX_RETRIES} retries. Marking as failed.`,
        );

        try {
          await prisma.message.update({
            where: { id: data.id },
            data: { status: MessageStatus.failed },
          });
          await publishStatusUpdate(data.id, MessageStatus.failed);
        } catch (dbError) {
          console.error(
            `[DLQ] Failed to update status for ${data?.id}:`,
            dbError,
          );
        }

        channel.ack(msg);
      }
    });

    connection.on("error", (err) => {
      console.error("[AMQP] Connection error", err);
      setTimeout(startConsumer, 5000);
    });

    connection.on("close", () => {
      console.error("[AMQP] Connection closed, reconnecting...");
      setTimeout(startConsumer, 5000);
    });
  } catch (error) {
    console.error("[AMQP] Error starting consumer:", error);
    setTimeout(startConsumer, 5000);
  }
}
