import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Maps Redis Pub/Sub channel names to Socket.IO event names. */
const CHANNEL_TO_EVENT: Record<string, string> = {
  'message.status': 'message:status',
  'message.new': 'new_message',
  'message.read': 'message:read',
  'user.new': 'new_user',
};

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly redisSub: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisSub = new Redis(redisUrl);
  }

  async afterInit() {
    const channels = Object.keys(CHANNEL_TO_EVENT);

    await this.redisSub.subscribe(...channels, (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to Redis:', err.message);
      } else {
        this.logger.log(`Subscribed to ${String(count)} Redis channel(s)`);
      }
    });

    this.redisSub.on('message', (channel: string, message: string) => {
      const eventName = CHANNEL_TO_EVENT[channel];
      if (!eventName) {
        this.logger.warn(`Received message on unknown channel: ${channel}`);
        return;
      }

      try {
        const data = JSON.parse(message) as unknown;
        this.server.emit(eventName, data);
      } catch {
        this.logger.error(
          `Failed to parse Redis message on "${channel}":`,
          message,
        );
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── User room registration (for targeted signaling) ───────────
  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    void client.join(`user:${data.userId}`);
    this.logger.log(`User ${data.userId} joined room user:${data.userId}`);
  }

  // ── WebRTC Signaling ──────────────────────────────────────────

  @SubscribeMessage('call:initiate')
  handleCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { callerId: string; callerName: string; receiverId: string },
  ) {
    this.logger.log(`Call: ${data.callerId} → ${data.receiverId}`);
    this.server.to(`user:${data.receiverId}`).emit('call:incoming', {
      callerId: data.callerId,
      callerName: data.callerName,
    });
  }

  @SubscribeMessage('call:ringing')
  handleCallRinging(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: string; receiverId: string },
  ) {
    this.logger.log(`Call ringing: ${data.receiverId} → ${data.callerId}`);
    this.server.to(`user:${data.callerId}`).emit('call:ringing', {
      receiverId: data.receiverId,
    });
  }

  @SubscribeMessage('call:accept')
  handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: string; receiverId: string },
  ) {
    this.logger.log(`Call accepted: ${data.receiverId} → ${data.callerId}`);
    this.server.to(`user:${data.callerId}`).emit('call:accepted', {
      receiverId: data.receiverId,
    });
  }

  @SubscribeMessage('call:reject')
  handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: string; receiverId: string },
  ) {
    this.logger.log(`Call rejected: ${data.receiverId} → ${data.callerId}`);
    this.server.to(`user:${data.callerId}`).emit('call:rejected', {
      receiverId: data.receiverId,
    });
  }

  @SubscribeMessage('call:end')
  handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string },
  ) {
    this.logger.log(`Call ended → ${data.targetId}`);
    this.server.to(`user:${data.targetId}`).emit('call:ended');
  }

  @SubscribeMessage('webrtc:offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; offer: RTCSessionDescriptionInit },
  ) {
    this.server.to(`user:${data.targetId}`).emit('webrtc:offer', {
      offer: data.offer,
    });
  }

  @SubscribeMessage('webrtc:answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { targetId: string; answer: RTCSessionDescriptionInit },
  ) {
    this.server.to(`user:${data.targetId}`).emit('webrtc:answer', {
      answer: data.answer,
    });
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; candidate: RTCIceCandidateInit },
  ) {
    this.server.to(`user:${data.targetId}`).emit('webrtc:ice-candidate', {
      candidate: data.candidate,
    });
  }
}
