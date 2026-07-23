import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../../common/errors/app-error-code';
import {
  CardNotFoundException,
  CardNotOwnedException,
  CardRequiredException,
} from './card.exceptions';

describe('CardNotFoundException', () => {
  it('404 con el cardId en el mensaje', () => {
    const exception = new CardNotFoundException('card-1');

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.CardNotFound,
      message: 'Tarjeta card-1 no encontrada',
    });
  });
});

describe('CardNotOwnedException', () => {
  it('403 con code CARD_NOT_OWNED', () => {
    const exception = new CardNotOwnedException();

    expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.CardNotOwned,
      message: 'Esta tarjeta no pertenece a tu sesión',
    });
  });
});

describe('CardRequiredException', () => {
  it('400 con code CARD_REQUIRED', () => {
    const exception = new CardRequiredException();

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.CardRequired,
      message: 'Oneclick requiere una tarjeta inscrita (cardId)',
    });
  });
});
