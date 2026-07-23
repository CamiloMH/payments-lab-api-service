import {
  CardEnrolledEvent,
  OrderSettledEvent,
  OrderStatus,
  StockChangedEvent,
  WsEvent,
  WsRoom,
  WsRoomPrefix,
} from '@/domain';
import type { Server, Socket } from 'socket.io';

import { RealtimeGateway } from './realtime.gateway';

function buildGateway() {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const gateway = new RealtimeGateway();
  gateway.server = { to } as unknown as Server;
  return { gateway, to, emit };
}

describe('RealtimeGateway', () => {
  it('onOrderSettled reenvía a la room de la orden', () => {
    const { gateway, to, emit } = buildGateway();

    gateway.onOrderSettled(new OrderSettledEvent('order-1', OrderStatus.Paid));

    expect(to).toHaveBeenCalledWith(WsRoomPrefix.Order + 'order-1');
    expect(emit).toHaveBeenCalledWith(
      WsEvent.OrderSettled,
      expect.objectContaining({ orderId: 'order-1', status: OrderStatus.Paid }),
    );
  });

  it('onCardEnrolled reenvía a la room de la sesión', () => {
    const { gateway, to, emit } = buildGateway();

    gateway.onCardEnrolled(new CardEnrolledEvent('session-1', 'card-1', 'Visa', '4242'));

    expect(to).toHaveBeenCalledWith(WsRoomPrefix.Session + 'session-1');
    expect(emit).toHaveBeenCalledWith(
      WsEvent.CardEnrolled,
      expect.objectContaining({ cardId: 'card-1', cardType: 'Visa', cardLast4: '4242' }),
    );
  });

  it('onStockChanged reenvía a la room de la tienda', () => {
    const { gateway, to, emit } = buildGateway();

    gateway.onStockChanged(new StockChangedEvent('p1', 6));

    expect(to).toHaveBeenCalledWith(WsRoom.Store);
    expect(emit).toHaveBeenCalledWith(
      WsEvent.StockChanged,
      expect.objectContaining({ productId: 'p1', available: 6 }),
    );
  });

  it('los handlers de join unen al cliente a la room correcta', () => {
    const { gateway } = buildGateway();
    const join = jest.fn();
    const client = { join } as unknown as Socket;

    gateway.handleJoinStore(client);
    gateway.handleJoinOrder(client, 'order-1');
    gateway.handleJoinSession(client, 'session-1');

    expect(join).toHaveBeenCalledWith(WsRoom.Store);
    expect(join).toHaveBeenCalledWith(WsRoomPrefix.Order + 'order-1');
    expect(join).toHaveBeenCalledWith(WsRoomPrefix.Session + 'session-1');
  });
});
