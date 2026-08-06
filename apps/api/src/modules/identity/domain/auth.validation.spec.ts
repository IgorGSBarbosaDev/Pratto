import { passwordSchema } from '@pratto/validation';

describe('password validation', () => {
  it('counts Unicode code points and preserves whitespace', () => {
    const value = '  senha com 🍽️  ';
    const parsed = passwordSchema.parse(value);

    expect(parsed).toBe(value);
  });

  it('accepts only the 15 to 128 code point range', () => {
    expect(passwordSchema.safeParse('a'.repeat(14)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(15)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});
