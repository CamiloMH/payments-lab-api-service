import type { DemoSession } from '../entities/demo-session.entity';
import { SessionResponse } from './session.response';

describe('SessionResponse.from', () => {
  it('expone solo id', () => {
    const session = {
      id: 'session-1',
      createdAt: new Date(),
      lastSeenAt: new Date(),
    } as DemoSession;

    const response = SessionResponse.from(session);

    expect(response).toEqual({ id: 'session-1' });
    expect(response).not.toHaveProperty('createdAt');
    expect(response).not.toHaveProperty('lastSeenAt');
  });
});
