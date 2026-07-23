import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { OrderEvent } from '../entities/order-event.entity';

/** Encapsula el acceso a TypeORM para `OrderEvent`. */
@Injectable()
export class OrderEventRepository {
  constructor(@InjectRepository(OrderEvent) private readonly repo: Repository<OrderEvent>) {}

  save(event: OrderEvent): Promise<OrderEvent> {
    return this.repo.save(event);
  }

  /** Eventos de una orden en orden cronológico (más antiguos primero, para renderizar el timeline). */
  findByOrder(orderId: string): Promise<OrderEvent[]> {
    return this.repo.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }
}
