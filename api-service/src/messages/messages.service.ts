import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto, QueryMessagesDto } from './dto/message.dto';
import { MessageStatus } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const REDIS_CHANNEL = {
  MESSAGE_READ: 'message.read',
} as const;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly redisPub: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisPub = new Redis(redisUrl);
  }

  async create(createMessageDto: CreateMessageDto) {
    const { senderId, receiverId, message, idempotencyKey } = createMessageDto;

    if (senderId === receiverId) {
      throw new BadRequestException('Sender and receiver cannot be the same');
    }

    // Verify both users exist in parallel
    const [sender, receiver] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId } }),
      this.prisma.user.findUnique({ where: { id: receiverId } }),
    ]);

    if (!sender || !receiver) {
      throw new BadRequestException('Sender or receiver not found');
    }

    // Handle idempotency — return existing message if key already used
    if (idempotencyKey) {
      const existing = await this.prisma.message.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        this.logger.debug(`Idempotent hit for key "${idempotencyKey}"`);
        return existing;
      }
    }

    const newMessage = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        message,
        idempotencyKey,
        status: MessageStatus.queued,
      },
    });

    this.queueService.publishMessage(newMessage.id, {
      senderId,
      receiverId,
      message,
    });

    this.logger.log(`Message ${newMessage.id} created and queued`);
    return newMessage;
  }

  async findAll(query: QueryMessagesDto) {
    const { receiverId, senderId } = query;

    return this.prisma.message.findMany({
      where: {
        ...(receiverId && { receiverId }),
        ...(senderId && { senderId }),
      },
      include: {
        sender: { select: { id: true, name: true, phone: true } },
        receiver: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: MessageStatus) {
    return this.prisma.message.update({
      where: { id },
      data: { status },
    });
  }

  async markAllAsRead(receiverId: string, senderId: string) {
    const now = new Date();

    const unreadMessages = await this.prisma.message.findMany({
      where: { receiverId, senderId, readAt: null },
      select: { id: true },
    });

    if (unreadMessages.length === 0) {
      return { count: 0 };
    }

    const { count } = await this.prisma.message.updateMany({
      where: { receiverId, senderId, readAt: null },
      data: { readAt: now },
    });

    // Notify sender in parallel for all read messages
    const readAt = now.toISOString();
    await Promise.all(
      unreadMessages.map((msg) =>
        this.redisPub.publish(
          REDIS_CHANNEL.MESSAGE_READ,
          JSON.stringify({ messageId: msg.id, readAt }),
        ),
      ),
    );

    this.logger.log(
      `Marked ${count} message(s) as read (sender=${senderId}, receiver=${receiverId})`,
    );
    return { count };
  }

  async markAsRead(id: string) {
    const now = new Date();

    const message = await this.prisma.message.update({
      where: { id },
      data: { readAt: now },
    });

    await this.redisPub.publish(
      REDIS_CHANNEL.MESSAGE_READ,
      JSON.stringify({ messageId: id, readAt: now.toISOString() }),
    );

    this.logger.log(`Message ${id} marked as read`);
    return message;
  }
}
