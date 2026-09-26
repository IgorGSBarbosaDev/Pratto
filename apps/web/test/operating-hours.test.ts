import type { EstablishmentOperatingHours } from '@pratto/contracts';
import { describe, expect, it } from 'vitest';

import { isOpenNow } from '../features/public-menu/operating-hours';

function hours(overrides: Partial<EstablishmentOperatingHours> = {}): EstablishmentOperatingHours {
  const closed = { closed: true, open: '09:00', close: '18:00' };
  return {
    monday: closed,
    tuesday: closed,
    wednesday: closed,
    thursday: closed,
    friday: closed,
    saturday: closed,
    sunday: closed,
    ...overrides,
  };
}

describe('public establishment hours', () => {
  it('uses the establishment time zone instead of the visitor device time zone', () => {
    const schedule = hours({
      saturday: { closed: false, open: '10:00', close: '13:00' },
    });

    expect(isOpenNow(schedule, 'America/Sao_Paulo', new Date('2026-09-26T14:30:00.000Z'))).toBe(
      true,
    );
  });

  it('keeps an overnight schedule open after midnight on the following day', () => {
    const schedule = hours({
      monday: { closed: false, open: '20:00', close: '02:00' },
    });

    expect(isOpenNow(schedule, 'America/Sao_Paulo', new Date('2026-09-29T04:00:00.000Z'))).toBe(
      true,
    );
  });

  it('does not mark equal or closed intervals as open', () => {
    const schedule = hours({
      saturday: { closed: false, open: '10:00', close: '10:00' },
    });

    expect(isOpenNow(schedule, 'America/Sao_Paulo', new Date('2026-09-26T14:00:00.000Z'))).toBe(
      false,
    );
  });
});
