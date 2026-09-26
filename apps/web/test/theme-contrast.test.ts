import { accessibleThemeColors, contrastRatio } from '@pratto/validation';
import { describe, expect, it } from 'vitest';

describe('accessible theme colors', () => {
  it.each(['#166534', '#d65a31', '#f5c542', '#ffffff', '#111111'])(
    'chooses readable foregrounds for %s',
    (accent) => {
      const colors = accessibleThemeColors(accent);

      expect(contrastRatio(accent, colors.onPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.readableOnLight, '#fff9f4')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.readableOnDark, '#181716')).toBeGreaterThanOrEqual(4.5);
    },
  );
});
