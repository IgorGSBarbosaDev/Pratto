import { establishmentAddressSchema, establishmentUpdateSchema } from '@pratto/validation';

describe('establishment validation', () => {
  it('accepts valid public data and normalizes empty optional contact fields', () => {
    const result = establishmentUpdateSchema.parse({
      name: 'Café Aurora',
      slug: 'cafe-aurora',
      phone: '  (31) 3333-4444 ',
      whatsapp: '',
      address: {
        street: 'Rua Central',
        number: '10',
        complement: '',
        neighborhood: 'Centro',
        city: 'Belo Horizonte',
        state: 'MG',
        postalCode: '30110-000',
      },
      theme: { mode: 'LIGHT', primaryColor: '#166534' },
    });

    expect(result.phone).toBe('(31) 3333-4444');
    expect(result.whatsapp).toBeNull();
    expect(result.address).toMatchObject({ city: 'Belo Horizonte' });
  });

  it('rejects malformed slug, address and theme values', () => {
    expect(() => establishmentUpdateSchema.parse({ slug: 'Café Aurora' })).toThrow();
    expect(() =>
      establishmentAddressSchema.parse({
        street: '',
        number: '',
        complement: '',
        neighborhood: 'Centro',
        city: 'Belo Horizonte',
        state: 'M',
        postalCode: '000',
      }),
    ).toThrow();
    expect(() =>
      establishmentUpdateSchema.parse({ theme: { mode: 'LIGHT', primaryColor: 'green' } }),
    ).toThrow();
  });

  it('rejects unknown fields instead of silently accepting them', () => {
    expect(() => establishmentUpdateSchema.parse({ unknown: 'value' })).toThrow();
  });
});
