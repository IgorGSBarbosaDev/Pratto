import { nextDate, startOfDateInTimeZone } from './time-zone';

describe('analytics time zone boundaries', () => {
  it('starts dashboard days at establishment-local midnight in São Paulo', () => {
    expect(startOfDateInTimeZone('2026-09-26', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-09-26T03:00:00.000Z',
    );
  });

  it('uses 23-hour and 25-hour local days across daylight-saving transitions', () => {
    const beforeSpringForward = startOfDateInTimeZone('2026-03-08', 'America/New_York');
    const afterSpringForward = startOfDateInTimeZone('2026-03-09', 'America/New_York');
    const beforeFallBack = startOfDateInTimeZone('2026-11-01', 'America/New_York');
    const afterFallBack = startOfDateInTimeZone('2026-11-02', 'America/New_York');

    expect(beforeSpringForward.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(afterSpringForward.getTime() - beforeSpringForward.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(beforeFallBack.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(afterFallBack.getTime() - beforeFallBack.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it('advances a calendar date without depending on the server time zone', () => {
    expect(nextDate('2026-02-28')).toBe('2026-03-01');
  });
});
