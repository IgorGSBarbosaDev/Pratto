import {
  analyticsDashboardQuerySchema,
  analyticsIngestSchema,
  categoryCreateSchema,
  categoryReorderSchema,
  establishmentUpdateSchema,
  invitationAcceptSchema,
  productCreateSchema,
  publicMenuQuerySchema,
  teamInviteSchema,
} from '@pratto/validation';

describe('shared validation regression rules', () => {
  it('normalizes and enforces category/product boundaries', () => {
    expect(categoryCreateSchema.parse({ name: '  Entradas  ', description: '  Quentes ' })).toEqual(
      { name: 'Entradas', description: 'Quentes' },
    );
    expect(categoryCreateSchema.safeParse({ name: '', extra: true }).success).toBe(false);
    expect(categoryReorderSchema.safeParse({ categoryIds: ['not-uuid'] }).success).toBe(false);
    expect(
      productCreateSchema.parse({
        categoryId: '11111111-1111-4111-8111-111111111111',
        name: 'Prato',
        price: '10.5',
      }),
    ).toMatchObject({ price: '10.50', availability: 'AVAILABLE', featured: false });
    expect(
      productCreateSchema.safeParse({
        categoryId: '11111111-1111-4111-8111-111111111111',
        name: 'Prato',
        price: '10',
        promotionalPrice: '10.01',
      }).success,
    ).toBe(false);
    expect(
      productCreateSchema.safeParse({
        categoryId: '11111111-1111-4111-8111-111111111111',
        name: 'Prato',
        price: '10.999',
      }).success,
    ).toBe(false);
  });

  it('keeps public query, analytics and dashboard limits explicit', () => {
    expect(publicMenuQuerySchema.parse({ search: '  prato ', limit: '12' })).toMatchObject({
      search: 'prato',
      limit: 12,
    });
    expect(publicMenuQuerySchema.safeParse({ limit: 13 }).success).toBe(false);
    const event = {
      eventId: '11111111-1111-4111-8111-111111111111',
      publicationId: '22222222-2222-4222-8222-222222222222',
      occurredAt: '2026-08-23T12:00:00.000Z',
      eventType: 'menu_opened',
    };
    expect(
      analyticsIngestSchema.safeParse({
        establishmentPublicId: 'public',
        sessionId: '33333333-3333-4333-8333-333333333333',
        events: [event],
      }).success,
    ).toBe(true);
    expect(
      analyticsIngestSchema.safeParse({
        establishmentPublicId: 'public',
        sessionId: 'bad',
        events: [],
      }).success,
    ).toBe(false);
    expect(
      analyticsDashboardQuerySchema.safeParse({
        from: '2026-08-10T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      analyticsDashboardQuerySchema.safeParse({
        from: '2026-08-01T00:00:00.000Z',
        to: '2027-08-03T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('normalizes establishment contact fields and protects team invitation inputs', () => {
    expect(
      establishmentUpdateSchema.parse({ name: 'Casa', phone: '   ', description: '  ' }),
    ).toEqual({ name: 'Casa', phone: null, description: null });
    expect(
      establishmentUpdateSchema.safeParse({ theme: { mode: 'LIGHT', primaryColor: 'red' } })
        .success,
    ).toBe(false);
    expect(teamInviteSchema.parse({ email: ' PERSON@EXAMPLE.COM ', role: 'MEMBER' })).toEqual({
      email: 'person@example.com',
      role: 'MEMBER',
    });
    expect(invitationAcceptSchema.safeParse({ token: 'short', password: 'short' }).success).toBe(
      false,
    );
  });
});
