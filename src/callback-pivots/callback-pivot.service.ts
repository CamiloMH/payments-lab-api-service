import { Injectable, Logger } from '@nestjs/common';
import { PIVOT_TTL_MINUTES } from '@/domain';

import { formatLogFields } from '../common/logging/format-log-fields';
import { CallbackPivotRepository } from './repositories/callback-pivot.repository';
import { CallbackPivot } from './entities/callback-pivot.entity';
import {
  PivotAlreadyConsumedException,
  PivotExpiredException,
  PivotNotFoundException,
} from './exceptions/pivot.exceptions';

/** Input para crear un pivot: exactamente uno de los dos ids debe estar presente. */
export interface CreatePivotInput {
  redirectPath: string;
  paymentAttemptId?: string;
  enrollmentSessionId?: string;
}

/**
 * Contexto de un retorno redirect (Webpay/MP) o de una inscripción Oneclick,
 * indexado por UUID. TTL corto + `consumedAt` evitan reprocesar el mismo
 * callback dos veces (replay del navegador, doble POST, etc.).
 */
@Injectable()
export class CallbackPivotService {
  private readonly logger = new Logger(CallbackPivotService.name);

  constructor(private readonly pivots: CallbackPivotRepository) {}

  async create(input: CreatePivotInput): Promise<CallbackPivot> {
    const pivot = this.pivots.create({
      paymentAttemptId: input.paymentAttemptId ?? null,
      enrollmentSessionId: input.enrollmentSessionId ?? null,
      redirectPath: input.redirectPath,
      expiresAt: new Date(Date.now() + PIVOT_TTL_MINUTES * 60_000),
      consumedAt: null,
    });
    const saved = await this.pivots.save(pivot);
    this.logger.log(formatLogFields({ pivotId: saved.id, redirectPath: input.redirectPath }));
    return saved;
  }

  /**
   * Guarda el token externo (ej. el de `start()` de la inscripción Oneclick)
   * en un pivot ya creado, para reusarlo al resolver el callback.
   * @throws {PivotNotFoundException} si el pivot no existe.
   */
  async attachExternalToken(pivotId: string, externalToken: string): Promise<void> {
    this.logger.log(formatLogFields({ pivotId }));

    const pivot = await this.pivots.findById(pivotId);
    if (!pivot) {
      throw new PivotNotFoundException(pivotId);
    }
    pivot.externalToken = externalToken;
    await this.pivots.save(pivot);
  }

  /** Valida y marca el pivot como consumido. Lanza si no existe, expiró o ya fue usado. */
  async consume(pivotId: string): Promise<CallbackPivot> {
    this.logger.log(formatLogFields({ pivotId }));

    const pivot = await this.pivots.findById(pivotId);
    if (!pivot) {
      throw new PivotNotFoundException(pivotId);
    }
    if (pivot.consumedAt) {
      throw new PivotAlreadyConsumedException();
    }
    if (pivot.expiresAt.getTime() < Date.now()) {
      throw new PivotExpiredException();
    }

    pivot.consumedAt = new Date();
    return this.pivots.save(pivot);
  }
}
