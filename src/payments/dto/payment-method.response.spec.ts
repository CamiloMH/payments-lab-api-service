import { PaymentProviderId, type PaymentMethodDescriptor } from '@/domain';
import { PaymentMethodResponse } from './payment-method.response';

describe('PaymentMethodResponse.from', () => {
  it('expone id, labelKey y requiresInscribedCard, oculta supportsRefund', () => {
    const descriptor: PaymentMethodDescriptor = {
      id: PaymentProviderId.TransbankOneclick,
      labelKey: 'paymentMethods.oneclick',
      requiresInscribedCard: true,
      supportsRefund: true,
    };

    const response = PaymentMethodResponse.from(descriptor);

    expect(response).toEqual({
      id: PaymentProviderId.TransbankOneclick,
      labelKey: 'paymentMethods.oneclick',
      requiresInscribedCard: true,
    });
    expect(response).not.toHaveProperty('supportsRefund');
  });
});
