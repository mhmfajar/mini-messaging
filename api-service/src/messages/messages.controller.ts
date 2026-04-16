import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
  Patch,
  Param,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import {
  CreateMessageDto,
  QueryMessagesDto,
  MarkReadDto,
} from './dto/message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() query: QueryMessagesDto) {
    return { data: await this.messagesService.findAll(query) };
  }

  @Patch('read-all/:senderId')
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAllAsRead(
    @Param('senderId') senderId: string,
    @Body() body: MarkReadDto,
  ) {
    return this.messagesService.markAllAsRead(body.receiverId, senderId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.messagesService.markAsRead(id);
  }
}
