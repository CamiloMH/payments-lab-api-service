import { ApiProperty } from '@nestjs/swagger';
import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';
import { Expose, plainToInstance } from 'class-transformer';
import type { OrderEvent } from '../entities/order-event.entity';

/**
 * Forma pública de una entrada del timeline de una orden. Todos los campos
 * son seguros por construcción (`OrderEventService.record` nunca guarda
 * payload/token crudo de un PSP en `detail`), así que se exponen completos.
 * Oculta el `orderId`: el cliente ya lo conoce por la ruta (`/orders/:id/timeline`).
 */
export class OrderEventResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único del evento.' })
  id!: string;

  @Expose()
  @ApiProperty({
    enum: OrderEventType,
    description: 'Tipo de evento del ciclo de vida de la orden.',
  })
  type!: OrderEventType;

  @Expose()
  @ApiProperty({
    enum: OrderStatus,
    nullable: true,
    description: 'Estado de la orden antes de esta transición, o `null` si no aplica.',
  })
  fromStatus!: OrderStatus | null;

  @Expose()
  @ApiProperty({
    enum: OrderStatus,
    nullable: true,
    description: 'Estado de la orden después de esta transición, o `null` si no aplica.',
  })
  toStatus!: OrderStatus | null;

  @Expose()
  @ApiProperty({
    enum: PaymentProviderId,
    nullable: true,
    description: 'Proveedor de pago involucrado, o `null` si el evento no es específico de un PSP.',
  })
  provider!: PaymentProviderId | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Id del intento de pago asociado, o `null` si no aplica.',
  })
  attemptId!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, description: 'Texto de auditoría corto que describe el evento.' })
  detail!: string | null;

  @Expose()
  @ApiProperty({ description: 'Fecha en que ocurrió el evento.' })
  createdAt!: Date;

  static from(event: OrderEvent): OrderEventResponse {
    return plainToInstance(OrderEventResponse, event, { excludeExtraneousValues: true });
  }
}
