import type { PaymentInitiation, PaymentProviderId } from '@/domain';

import type { DemoSession } from '../../session/entities/demo-session.entity';
import type { InscribedCard } from '../entities/inscribed-card.entity';

/**
 * Puerto segregado (ISP): solo los proveedores que soportan inscripción de
 * tarjeta (hoy, Oneclick) lo implementan. Webpay/Mercado Pago no lo necesitan.
 */
export interface CardEnrollmentPort {
  readonly id: PaymentProviderId;

  initiateEnrollment(ctx: {
    session: DemoSession;
    pivotUuid: string;
    returnUrl: string;
  }): Promise<PaymentInitiation>;

  confirmEnrollment(params: {
    tbkToken: string;
  }): Promise<{ tbkUser: string; cardType: string; cardLast4: string; responseCode: number }>;

  deleteEnrollment(card: InscribedCard, session: DemoSession): Promise<void>;
}
