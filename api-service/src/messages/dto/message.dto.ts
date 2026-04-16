import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  senderId!: string;

  @IsUUID()
  @IsNotEmpty()
  receiverId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class QueryMessagesDto {
  @IsUUID()
  @IsOptional()
  receiverId?: string;

  @IsUUID()
  @IsOptional()
  senderId?: string;
}

export class MarkReadDto {
  @IsUUID()
  @IsNotEmpty()
  receiverId!: string;
}
