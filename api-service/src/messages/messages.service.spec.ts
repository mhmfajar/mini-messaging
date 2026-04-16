import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { ConfigService } from '@nestjs/config';
import { MessageStatus } from '@prisma/client';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      publish: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
  });
});

describe('MessagesService', () => {
  let service: MessagesService;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
    message: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockQueueService = {
    publishMessage: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const sender = { id: 'sender-1', name: 'Alice', phone: '111' };
    const receiver = { id: 'receiver-1', name: 'Bob', phone: '222' };
    const dto = {
      senderId: 'sender-1',
      receiverId: 'receiver-1',
      message: 'Hello!',
    };

    it('should create a message and publish to queue', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(receiver);
      mockPrismaService.message.create.mockResolvedValue({
        id: 'msg-1',
        ...dto,
        status: MessageStatus.queued,
        createdAt: new Date(),
      });

      const result = await service.create(dto);

      expect(result.id).toBe('msg-1');
      expect(result.status).toBe(MessageStatus.queued);
      expect(mockQueueService.publishMessage).toHaveBeenCalledWith('msg-1', {
        senderId: dto.senderId,
        receiverId: dto.receiverId,
        message: dto.message,
      });
    });

    it('should throw if sender and receiver are the same', async () => {
      await expect(
        service.create({ senderId: 'same', receiverId: 'same', message: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if sender does not exist', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(receiver);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw if receiver does not exist', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should return existing message for duplicate idempotency key', async () => {
      const existingMsg = { id: 'msg-existing', status: 'sent' };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(receiver);
      mockPrismaService.message.findUnique.mockResolvedValue(existingMsg);

      const result = await service.create({
        ...dto,
        idempotencyKey: 'key-123',
      });

      expect(result).toEqual(existingMsg);
      expect(mockPrismaService.message.create).not.toHaveBeenCalled();
      expect(mockQueueService.publishMessage).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return messages filtered by receiverId', async () => {
      const messages = [{ id: 'msg-1', message: 'Hello' }];
      mockPrismaService.message.findMany.mockResolvedValue(messages);

      const result = await service.findAll({ receiverId: 'r1' });

      expect(result).toEqual(messages);
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ receiverId: 'r1' }) as unknown,
        }),
      );
    });

    it('should return messages filtered by senderId', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      await service.findAll({ senderId: 's1' });

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ senderId: 's1' }) as unknown,
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update message status', async () => {
      const updated = { id: 'msg-1', status: MessageStatus.sent };
      mockPrismaService.message.update.mockResolvedValue(updated);

      const result = await service.updateStatus('msg-1', MessageStatus.sent);

      expect(result).toEqual(updated);
      expect(mockPrismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { status: MessageStatus.sent },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should return count 0 if no unread messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      const result = await service.markAllAsRead('receiver-1', 'sender-1');

      expect(result).toEqual({ count: 0 });
      expect(mockPrismaService.message.updateMany).not.toHaveBeenCalled();
    });

    it('should mark unread messages as read and return count', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([
        { id: 'msg-1' },
        { id: 'msg-2' },
      ]);
      mockPrismaService.message.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markAllAsRead('receiver-1', 'sender-1');

      expect(result).toEqual({ count: 2 });
      expect(mockPrismaService.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            receiverId: 'receiver-1',
            senderId: 'sender-1',
            readAt: null,
          },
          data: expect.objectContaining({
            readAt: expect.any(Date) as unknown,
          }) as unknown,
        }),
      );
    });
  });
});
