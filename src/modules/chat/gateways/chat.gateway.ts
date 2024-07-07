import { CreateMessageDto } from '@chat/dto/create-message.dto';
import { Events } from '@chat/enums/events.enum';
import { ChatService } from '@chat/services/chat.service';
import { MessageService } from '@chat/services/message.service';
import { Logger, Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: process.env.CLIENT_URL,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  public constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
  ) { }

  public async handleConnection(
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const userId = this.getUserId(socket);
    if (!userId) return;

    this.logger.log(`User connected: ${userId}`);
    try {
      await this.handleUserStatusChange(userId, true, socket);
    } catch (error) {
      this.handleError('Error handling connection', error, socket);
    }
  }

  public async handleDisconnect(
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const userId = this.getUserId(socket);
    if (!userId) return;

    this.logger.log(`User disconnected: ${userId}`);
    try {
      await this.handleUserStatusChange(userId, false, socket);
    } catch (error) {
      this.handleError('Error handling disconnection', error, socket);
    }
  }

  @SubscribeMessage(Events.JOIN)
  public async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() chatId: string,
  ): Promise<void> {
    if (!chatId) {
      this.logger.warn('User tried to join a chat without chatId');
      return;
    }
    try {
      const userId = this.getUserId(socket);
      socket.join(chatId);
      socket.emit('join_ack', { message: 'Successfully joined chat' });
      this.server.to(chatId).emit('user_joined', { userId });
    } catch (error) {
      this.handleError('Error handling join', error, socket);
    }
  }

  @SubscribeMessage(Events.SEND_MESSAGE)
  public async handleMessage(
    @MessageBody() message: CreateMessageDto,
  ): Promise<void> {
    this.logger.log('Message received', JSON.stringify(message));
    try {
      const savedMessage = await this.messageService.createMessage(message);
      this.server
        .to(message.chatId as string)
        .emit(Events.RECEIVE_MESSAGE, savedMessage);
    } catch (error) {
      this.logger.error('Error handling message', error.stack);
      throw new WsException('Failed to send message');
    }
  }

  @SubscribeMessage(Events.REQUEST_ALL_MESSAGES)
  public async requestAllMessages(
    @ConnectedSocket() socket: Socket,
    @MessageBody() chatId: string,
  ): Promise<void> {
    if (!chatId) {
      this.logger.warn('User requested all messages without chatId');
      return;
    }
    const messages = await this.messageService.getChatMessages(chatId);
    socket.emit(Events.SEND_ALL_MESSAGES, messages);
  }

  @SubscribeMessage(Events.REQUEST_ALL_CHATS)
  private async sendUserChatsList(
    socket: Socket,
    userId: string,
  ): Promise<void> {
    const chats = await this.chatService.getUserChats(userId);
    socket.emit(Events.CHATS, chats);
  }

  @SubscribeMessage(Events.LEAVE)
  public async handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() chatId: string,
  ): Promise<void> {
    if (!chatId) {
      this.logger.warn('User tried to leave a chat without chatId');
      return;
    }

    try {
      const userId = this.getUserId(socket);

      socket.leave(chatId);
      socket.emit('leave_ack', { message: 'Successfully left chat' });
      this.server.to(chatId).emit('user_left', { userId });
    } catch (error) {
      this.handleError('Error handling leave', error, socket);
    }
  }

  private getUserId(socket: Socket): string | null {
    const userId = socket.handshake.query.userId;
    if (typeof userId !== 'string') {
      this.logger.warn('Invalid userId');
      socket.disconnect();
      return null;
    }
    return userId;
  }

  private async handleUserStatusChange(
    userId: string,
    isOnline: boolean,
    socket: Socket,
  ): Promise<void> {
    await this.chatService.updateUserOnlineStatus(userId, isOnline);
    if (isOnline) {
      await this.sendUserChatsList(socket, userId);
      this.chatService.watchChatCollectionChanges(socket);
    }
  }

  private handleError(message: string, error: any, socket: Socket): void {
    this.logger.error(`${message}: ${error.stack}`);
    socket.emit('error', { message: error.message });
  }
}
