import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject('MESSAGING_SERVICE') private readonly client: ClientProxy,
  ) {}

  publishMessage(messageId: string, payload: any) {
    this.logger.log(`Publishing message ${messageId} to queue`);
    return this.client.emit('message.send', {
      id: messageId,
      ...payload,
    });
  }
}
