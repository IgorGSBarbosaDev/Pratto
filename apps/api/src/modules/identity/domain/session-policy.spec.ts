import { isSessionExpired, renewedSessionExpiration, shouldRenewSession } from './session-policy';

describe('session policy', () => {
  const now = new Date('2026-08-05T12:00:00.000Z');

  it('expires at either the idle or absolute boundary', () => {
    expect(
      isSessionExpired(
        new Date('2026-08-05T11:59:59.000Z'),
        new Date('2026-08-06T12:00:00.000Z'),
        now,
      ),
    ).toBe(true);
    expect(
      isSessionExpired(
        new Date('2026-08-06T12:00:00.000Z'),
        new Date('2026-08-05T12:00:00.000Z'),
        now,
      ),
    ).toBe(true);
  });

  it('renews no more often than every 15 minutes and never crosses the absolute limit', () => {
    expect(shouldRenewSession(new Date('2026-08-05T11:46:00.000Z'), now)).toBe(false);
    expect(shouldRenewSession(new Date('2026-08-05T11:45:00.000Z'), now)).toBe(true);
    expect(renewedSessionExpiration(now, new Date('2026-08-05T13:00:00.000Z')).toISOString()).toBe(
      '2026-08-05T13:00:00.000Z',
    );
  });
});
