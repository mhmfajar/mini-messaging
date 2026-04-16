import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly redisPub: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisPub = new Redis(redisUrl);
  }

  async register(registerUserDto: RegisterUserDto) {
    const { name, phone } = registerUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      this.logger.debug(`Returning existing user for phone "${phone}"`);
      return existingUser;
    }

    const newUser = await this.prisma.user.create({
      data: { name, phone },
    });

    await this.redisPub.publish('user.new', JSON.stringify(newUser));
    this.logger.log(`New user registered: ${newUser.id} (${newUser.name})`);

    return newUser;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { name } = updateUserDto;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { name },
    });

    this.logger.log(
      `User updated: ${updatedUser.id} (New Name: ${updatedUser.name})`,
    );
    return updatedUser;
  }

  async findAll() {
    return await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }
}
