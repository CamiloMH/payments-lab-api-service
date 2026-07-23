import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  AppEvent,
  type CardEnrolledEvent,
  type OrderSettledEvent,
  type StockChangedEvent,
  WsEvent,
  WsJoinMessage,
  WsRoom,
  WsRoomPrefix,
} from '@/domain';
import type { Server, Socket } from 'socket.io';

import { formatLogFields } from '../common/logging/format-log-fields';

/**
 * Superficie WebSocket única de la API. Reemplaza el polling del front con push
 * dirigido: cada cliente se une a la room de su orden (`order:{id}`), su sesión
 * (`session:{id}`) o la tienda (`store`), y recibe el evento cuando ocurre.
 *
 * Es **solo listener** de eventos de dominio (`@nestjs/event-emitter`): ningún
 * servicio lo inyecta. Los emisores publican `AppEvent.*` tras comprometer su
 * transacción y este gateway traduce cada uno al evento WS correspondiente.
 */
@WebSocketGateway({ path: '/ws', cors: { origin: true, credentials: true } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  /** Une al cliente a la room pública de la tienda para recibir cambios de stock. */
  @SubscribeMessage(WsJoinMessage.JoinStore)
  handleJoinStore(@ConnectedSocket() client: Socket): void {
    client.join(WsRoom.Store);
    this.logger.log(formatLogFields({ join: WsRoom.Store, socketId: client.id }));
  }

  /** Une al cliente a la room de una orden concreta para recibir su `order.settled`. */
  @SubscribeMessage(WsJoinMessage.JoinOrder)
  handleJoinOrder(@ConnectedSocket() client: Socket, @MessageBody() orderId: string): void {
    client.join(WsRoomPrefix.Order + orderId);
    this.logger.log(formatLogFields({ join: WsRoomPrefix.Order + orderId, socketId: client.id }));
  }

  /** Une al cliente a la room de su sesión para recibir los `card.enrolled` de sus tarjetas. */
  @SubscribeMessage(WsJoinMessage.JoinSession)
  handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() sessionId: string): void {
    client.join(WsRoomPrefix.Session + sessionId);
    this.logger.log(
      formatLogFields({ join: WsRoomPrefix.Session + sessionId, socketId: client.id }),
    );
  }

  /** Reenvía a la room de la orden que quedó resuelta (paid/payment_failed/refunded). */
  @OnEvent(AppEvent.OrderSettled)
  onOrderSettled(event: OrderSettledEvent): void {
    this.logger.log(
      formatLogFields({
        ws: WsEvent.OrderSettled,
        room: WsRoomPrefix.Order + event.orderId,
        status: event.status,
      }),
    );
    this.server.to(WsRoomPrefix.Order + event.orderId).emit(WsEvent.OrderSettled, {
      orderId: event.orderId,
      status: event.status,
      occurredAt: new Date().toISOString(),
    });
  }

  /** Reenvía a la room de la sesión que una tarjeta Oneclick quedó inscrita. */
  @OnEvent(AppEvent.CardEnrolled)
  onCardEnrolled(event: CardEnrolledEvent): void {
    this.logger.log(
      formatLogFields({
        ws: WsEvent.CardEnrolled,
        room: WsRoomPrefix.Session + event.sessionId,
        cardId: event.cardId,
        cardType: event.cardType,
        cardLast4: event.cardLast4,
      }),
    );
    this.server.to(WsRoomPrefix.Session + event.sessionId).emit(WsEvent.CardEnrolled, {
      cardId: event.cardId,
      cardType: event.cardType,
      cardLast4: event.cardLast4,
      occurredAt: new Date().toISOString(),
    });
  }

  /** Reenvía a la room de la tienda el cambio de stock disponible de un producto. */
  @OnEvent(AppEvent.StockChanged)
  onStockChanged(event: StockChangedEvent): void {
    this.logger.log(
      formatLogFields({
        ws: WsEvent.StockChanged,
        room: WsRoom.Store,
        productId: event.productId,
        available: event.available,
      }),
    );
    this.server.to(WsRoom.Store).emit(WsEvent.StockChanged, {
      productId: event.productId,
      available: event.available,
      occurredAt: new Date().toISOString(),
    });
  }
}
