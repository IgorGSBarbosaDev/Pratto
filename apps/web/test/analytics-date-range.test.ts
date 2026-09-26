import { describe, expect, it } from 'vitest';

import {
  dateRangeForDays,
  formatDashboardDay,
  inclusiveDays,
} from '../features/analytics/date-range';

describe('analytics date range', () => {
  it('uses the establishment calendar date for preset ranges', () => {
    const now = new Date('2026-09-26T01:00:00.000Z');

    expect(dateRangeForDays(7, 'America/Sao_Paulo', now)).toEqual({
      fromDate: '2026-09-19',
      toDate: '2026-09-25',
    });
  });

  it('formats date-only chart labels without shifting them to the browser time zone', () => {
    expect(formatDashboardDay('2026-09-26')).toContain('26');
    expect(inclusiveDays('2026-09-01', '2026-09-30')).toBe(30);
  });
});
