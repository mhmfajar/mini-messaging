import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      publish: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
  });
});

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should return existing user if phone already exists', async () => {
      const existingUser = {
        id: 'u1',
        name: 'Existing',
        phone: '628123456789',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.register({
        name: 'New Name',
        phone: '628123456789',
      });

      expect(result).toEqual(existingUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '628123456789' },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should create a new user if phone does not exist', async () => {
      const newUser = {
        id: 'u2',
        name: 'New User',
        phone: '628987654321',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(newUser);

      const result = await service.register({
        name: 'New User',
        phone: '628987654321',
      });

      expect(result).toEqual(newUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: { name: 'New User', phone: '628987654321' },
      });
    });
  });

  describe('findAll', () => {
    it('should return all users ordered by name', async () => {
      const users = [
        { id: 'u1', name: 'Alice', phone: '111' },
        { id: 'u2', name: 'Bob', phone: '222' },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = { id: 'u1', name: 'Alice', phone: '111' };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne('u1');

      expect(result).toEqual(user);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });
});
