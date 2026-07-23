import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { OrderItem } from '../entities/order-item.entity';

/** Encapsula el acceso a TypeORM para `OrderItem`. */
@Injectable()
export class OrderItemRepository {
  constructor(@InjectRepository(OrderItem) private readonly repo: Repository<OrderItem>) {}

  /** Persiste el snapshot de líneas de una orden (nombre y precio al momento de la compra). */
  saveMany(items: OrderItem[]): Promise<OrderItem[]> {
    return this.repo.save(items);
  }
}
