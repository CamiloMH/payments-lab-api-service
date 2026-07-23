import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentAttemptStatus, type PaymentProviderId } from '@/domain';
import type { Repository } from 'typeorm';

import { PaymentAttempt } from '../entities/payment-attempt.entity';

/** Encapsula el acceso a TypeORM para `PaymentAttempt`. */
@Injectable()
export class PaymentAttemptRepository {
  constructor(
    @InjectRepository(PaymentAttempt) private readonly repo: Repository<PaymentAttempt>,
  ) {}

  /** Intento de pago por id (= buyOrder hijo sin prefijo), o lanza si no existe. */
  findByIdOrFail(id: string): Promise<PaymentAttempt> {
    return this.repo.findOneOrFail({ where: { id } });
  }

  /** Último intento conocido de una orden contra un proveedor puntual (usado por el webhook de Mercado Pago). */
  findByOrderAndProvider(
    orderId: string,
    provider: PaymentProviderId,
  ): Promise<PaymentAttempt | null> {
    return this.repo.findOne({ where: { orderId, provider } });
  }

  /** El intento que efectivamente pagó la orden (el único que puede quedar `Confirmed`), para un refund. */
  findConfirmedByOrder(orderId: string): Promise<PaymentAttempt | null> {
    return this.repo.findOne({ where: { orderId, status: PaymentAttemptStatus.Confirmed } });
  }

  save(attempt: PaymentAttempt): Promise<PaymentAttempt> {
    return this.repo.save(attempt);
  }
}
