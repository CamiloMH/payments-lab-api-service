import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentProviderId } from '@/domain';
import { Expose, Type, plainToInstance } from 'class-transformer';
import type { PaymentTrace } from '../../payment-traces/entities/payment-trace.entity';
import type { Order } from '../entities/order.entity';
import { OrderItemResponse } from './order-item.response';

/**
 * Forma pública de una orden: lo que el front necesita para mostrar el
 * detalle (líneas, total, vencimiento de la reserva, método de pago usado) y
 * decidir qué acciones ofrecer (reintentar, cancelar, devolver). Oculta
 * `buyOrder` y `sessionId` (identificadores internos/de Transbank) y `updatedAt`.
 */
export class OrderResponse {
  @Expose()
  @ApiProperty({
    description: 'Identificador único de la orden (clave de acceso interna, tipo nanoid).',
  })
  id!: string;

  @Expose()
  @ApiProperty({
    nullable: true,
    description:
      'Número de orden legible para el usuario, aleatorio y no correlativo. `null` en órdenes antiguas.',
  })
  orderNumber!: string | null;

  @Expose()
  @ApiProperty({
    enum: OrderStatus,
    description: 'Estado actual en la máquina de estados de la orden.',
  })
  status!: OrderStatus;

  @Expose()
  @ApiProperty({ description: 'Monto total de la orden en pesos chilenos (CLP).' })
  totalClp!: number;

  @Expose()
  @ApiProperty({
    description: 'Vencimiento de la reserva de stock mientras la orden esté `pending_payment`.',
  })
  expiresAt!: Date;

  @Expose()
  @ApiProperty({ description: 'Fecha de creación de la orden.' })
  createdAt!: Date;

  @Expose()
  @Type(() => OrderItemResponse)
  @ApiProperty({
    type: [OrderItemResponse],
    description: 'Líneas de la orden (snapshot de productos comprados).',
  })
  items!: OrderItemResponse[];

  @Expose()
  @ApiProperty({
    enum: PaymentProviderId,
    nullable: true,
    description:
      'Proveedor de pago de la última interacción de la orden, o `null` si aún no hay ninguna.',
  })
  paymentMethod!: PaymentProviderId | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Últimos 4 dígitos de la tarjeta usada, si el PSP los informó.',
  })
  cardLast4!: string | null;

  /**
   * Construye la respuesta a partir de la orden y, opcionalmente, la última
   * traza de pago (de la que se derivan `paymentMethod` y `cardLast4`).
   */
  static from(order: Order, latestTrace?: PaymentTrace | null): OrderResponse {
    const response = plainToInstance(OrderResponse, order, { excludeExtraneousValues: true });
    response.paymentMethod = latestTrace?.provider ?? null;
    response.cardLast4 = latestTrace?.cardLast4 ?? null;
    return response;
  }
}
