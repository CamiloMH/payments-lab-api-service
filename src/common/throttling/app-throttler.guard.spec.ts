import { AppThrottlerGuard } from './app-throttler.guard';
import { TooManyRequestsException } from './too-many-requests.exception';

describe('AppThrottlerGuard', () => {
  it('lanza TooManyRequestsException al superar el límite (429 con código propio)', async () => {
    // Se accede al método protegido sin construir el guard completo (evita sus deps de Nest).
    const guard = Object.create(AppThrottlerGuard.prototype) as {
      throwThrottlingException: () => Promise<void>;
    };

    await expect(guard.throwThrottlingException()).rejects.toBeInstanceOf(TooManyRequestsException);
  });
});
