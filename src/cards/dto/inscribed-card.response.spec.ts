import { CardStatus } from '@/domain';
import type { InscribedCard } from '../entities/inscribed-card.entity';
import { InscribedCardResponse } from './inscribed-card.response';

describe('InscribedCardResponse.from', () => {
  it('expone solo id, cardType y cardLast4', () => {
    const card = {
      id: 'card-1',
      sessionId: 'session-1',
      tbkUser: 'tbk-user-secreto',
      cardType: 'Visa',
      cardLast4: '6623',
      status: CardStatus.Active,
      createdAt: new Date(),
    } as InscribedCard;

    const response = InscribedCardResponse.from(card);

    expect(response).toEqual({ id: 'card-1', cardType: 'Visa', cardLast4: '6623' });
    expect(response).not.toHaveProperty('tbkUser');
    expect(response).not.toHaveProperty('sessionId');
    expect(response).not.toHaveProperty('status');
  });
});
