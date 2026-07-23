import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';

import { PaymentTrace } from '../entities/payment-trace.entity';

/** Encapsula el acceso a TypeORM para `PaymentTrace` (bitácora append-only). */
@Injectable()
export class PaymentTraceRepository {
  constructor(@InjectRepository(PaymentTrace) private readonly repo: Repository<PaymentTrace>) {}

  save(trace: PaymentTrace): Promise<PaymentTrace> {
    return this.repo.save(trace);
  }

  /** Trazas de una orden en orden cronológico (más antiguas primero, para renderizar la bitácora). */
  findByOrder(orderId: string): Promise<PaymentTrace[]> {
    return this.repo.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Última traza de cada orden del set, en una sola query (evita N+1 al listar
   * órdenes). Como `find` las devuelve de más reciente a más antigua, la primera
   * vista por `orderId` es la más reciente y se conserva.
   */
  async latestByOrders(orderIds: string[]): Promise<Map<string, PaymentTrace>> {
    if (orderIds.length === 0) return new Map();
    const traces = await this.repo.find({
      where: { orderId: In(orderIds) },
      order: { createdAt: 'DESC' },
    });
    const latest = new Map<string, PaymentTrace>();
    for (const trace of traces) {
      if (!latest.has(trace.orderId)) latest.set(trace.orderId, trace);
    }
    return latest;
  }
}
