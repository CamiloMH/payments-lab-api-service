import {
  CURRENCY,
  IN_FLIGHT_GRACE_MINUTES,
  PIVOT_TTL_MINUTES,
  RESERVATION_TTL_MINUTES,
  SESSION_COOKIE_NAME,
  SYNTHETIC_EMAIL_DOMAIN,
} from './domain.constants';

describe('domain.constants', () => {
  it('define los valores esperados por el diseño de reservas y pivots', () => {
    expect(RESERVATION_TTL_MINUTES).toBe(10);
    expect(IN_FLIGHT_GRACE_MINUTES).toBe(5);
    expect(PIVOT_TTL_MINUTES).toBe(5);
    expect(CURRENCY).toBe('CLP');
    expect(SESSION_COOKIE_NAME).toBe('pl_session');
    expect(SYNTHETIC_EMAIL_DOMAIN).toBe('payments-lab.dev');
  });
});
