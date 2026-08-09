import type { StorageService } from '@pratto/contracts';
import { prisma } from '@pratto/database';

import { PublicMenuService } from './public-menu.service';
import type { PublicMenuServiceError } from './public-menu.service';

const publicationId = 'publication-id';
const categoryId = 'category-id';

function snapshot() {
  return {
    schemaVersion: 3,
    establishment: {
      publicId: 'establishment-public-id',
      name: 'Casa Aurora',
      slug: 'casa-aurora',
      description: 'Comida feita na hora',
      phone: null,
      whatsapp: null,
      address: null,
      operatingHours: {},
      logo: { storageKey: 'logo.png', contentType: 'image/png' },
      coverImage: null,
      theme: { mode: 'LIGHT', primaryColor: '#166534' },
    },
    menu: { name: 'Menu principal' },
    categories: [{ id: categoryId, name: 'Pratos', description: null }],
    products: [
      {
        id: 'product-1',
        categoryId,
        name: 'Prato 1',
        description: 'Descrição 1',
        price: '29.90',
        promotionalPrice: '24.90',
        ingredients: 'Ingredientes',
        allergens: 'Leite',
        availability: 'AVAILABLE',
        featured: true,
        displayOrder: 0,
      },
      {
        id: 'product-2',
        categoryId,
        name: 'Prato indisponível',
        description: null,
        price: '30.00',
        promotionalPrice: null,
        ingredients: null,
        allergens: null,
        availability: 'TEMPORARILY_UNAVAILABLE',
        featured: false,
        displayOrder: 1,
      },
      {
        id: 'product-hidden',
        categoryId,
        name: 'Rascunho oculto',
        description: null,
        price: '10.00',
        promotionalPrice: null,
        ingredients: null,
        allergens: null,
        availability: 'HIDDEN',
        featured: false,
        displayOrder: 2,
      },
    ],
    media: [
      {
        id: 'media-1',
        productId: 'product-1',
        mediaType: 'IMAGE',
        contentType: 'image/png',
        storageKey: 'product-1.png',
        displayOrder: 0,
        isPrimary: true,
      },
    ],
  };
}

function createStorage(): StorageService {
  return {
    upload: jest.fn(),
    delete: jest.fn(),
    getPublicUrl: jest.fn(),
    getReadUrl: jest.fn(async (key: string) => `signed:${key}`),
    health: jest.fn(),
  };
}

describe('PublicMenuService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads only the active publication and maps a safe public page', async () => {
    jest.spyOn(prisma.establishment, 'findFirst').mockResolvedValue({
      id: 'establishment-id',
      organizationId: 'organization-id',
    } as never);
    jest.spyOn(prisma.menu, 'findMany').mockResolvedValue([
      {
        activePublicationId: publicationId,
        activePublication: {
          id: publicationId,
          version: 4,
          publishedAt: new Date('2026-08-09T12:00:00.000Z'),
          snapshot: snapshot(),
        },
      },
    ] as never);
    const productFindMany = jest.spyOn(prisma.product, 'findMany');
    const storage = createStorage();

    const result = await new PublicMenuService(storage).getPage('establishment-public-id', {
      limit: 6,
    });

    expect(result).toMatchObject({
      establishment: {
        publicId: 'establishment-public-id',
        slug: 'casa-aurora',
        logo: { url: 'signed:logo.png', contentType: 'image/png' },
      },
      menu: {
        name: 'Menu principal',
        publicationId,
        version: 4,
      },
      products: [
        { id: 'product-1', availability: 'AVAILABLE', media: [{ url: 'signed:product-1.png' }] },
        { id: 'product-2', availability: 'TEMPORARILY_UNAVAILABLE', media: [] },
      ],
    });
    expect(result.products).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(JSON.stringify(result)).not.toContain('publishedBy');
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it('returns an opaque cursor for the next page and rejects a stale publication cursor', async () => {
    jest.spyOn(prisma.establishment, 'findFirst').mockResolvedValue({
      id: 'establishment-id',
      organizationId: 'organization-id',
    } as never);
    const menuFindMany = jest.spyOn(prisma.menu, 'findMany').mockResolvedValue([
      {
        activePublicationId: publicationId,
        activePublication: {
          id: publicationId,
          version: 1,
          publishedAt: new Date(),
          snapshot: snapshot(),
        },
      },
    ] as never);
    const service = new PublicMenuService(createStorage());
    const firstPage = await service.getPage('public-id', { limit: 1 });

    expect(firstPage.nextCursor).toEqual(expect.any(String));
    menuFindMany.mockResolvedValue([
      {
        activePublicationId: 'new-publication-id',
        activePublication: {
          id: 'new-publication-id',
          version: 2,
          publishedAt: new Date(),
          snapshot: snapshot(),
        },
      },
    ] as never);

    await expect(
      service.getPage('public-id', { limit: 1, cursor: firstPage.nextCursor! }),
    ).rejects.toMatchObject<Partial<PublicMenuServiceError>>({
      code: 'PUBLIC_MENU_CURSOR_STALE',
    });
  });

  it.each([
    ['without publication', [], 'PUBLIC_MENU_NOT_PUBLISHED'],
    [
      'with multiple active publications',
      [
        {
          activePublicationId: 'one',
          activePublication: {
            id: 'one',
            version: 1,
            publishedAt: new Date(),
            snapshot: snapshot(),
          },
        },
        {
          activePublicationId: 'two',
          activePublication: {
            id: 'two',
            version: 1,
            publishedAt: new Date(),
            snapshot: snapshot(),
          },
        },
      ],
      'PUBLIC_MENU_CONFIGURATION_INVALID',
    ],
  ])('rejects public access %s', async (_label, menus, code) => {
    jest.spyOn(prisma.establishment, 'findFirst').mockResolvedValue({
      id: 'establishment-id',
      organizationId: 'organization-id',
    } as never);
    jest.spyOn(prisma.menu, 'findMany').mockResolvedValue(menus as never);

    await expect(
      new PublicMenuService(createStorage()).getPage('public-id', { limit: 6 }),
    ).rejects.toMatchObject({ code });
  });
});
