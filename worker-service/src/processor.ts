import { prisma } from "./prisma";
import { MessageStatus } from "@prisma/client";
import { publishStatusUpdate, publishNewMessage } from "./redis-publisher";

interface MessagePayload {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
}

export async function processMessage(
  payload: MessagePayload,
): Promise<boolean> {
  const { id } = payload;
  console.log(`[Processor] Starting message ${id}`);

  try {
    // 1. Mark as processing
    await prisma.message.update({
      where: { id },
      data: { status: MessageStatus.processing },
    });
    console.log(`[Processor] Message ${id} -> PROCESSING`);
    await publishStatusUpdate(id, MessageStatus.processing);

    // 2. Simulate processing delay (0.5–1.5s)
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 3. Determine outcome (100% success rate for reliable delivery)
    const isSuccess = true;
    const finalStatus = isSuccess ? MessageStatus.sent : MessageStatus.failed;

    // 4. Persist final status
    await prisma.message.update({
      where: { id },
      data: { status: finalStatus },
    });
    console.log(
      `[Processor] Message ${id} -> ${finalStatus.toUpperCase()} (${delay}ms)`,
    );
    await publishStatusUpdate(id, finalStatus);

    // 5. On success, notify the recipient in real-time
    if (isSuccess) {
      const messageWithSender = await prisma.message.findUnique({
        where: { id },
        include: {
          sender: { select: { id: true, name: true, phone: true } },
        },
      });

      if (messageWithSender) {
        await publishNewMessage(messageWithSender);
      }
    }

    return isSuccess;
  } catch (error) {
    console.error(`[Processor] Error processing message ${id}:`, error);
    throw error;
  }
}
