import type { StorageService } from '@pratto/contracts';
import { prisma } from '@pratto/database';

import { PublicMenuService } from './public-menu.service';
import type { PublicMenuServiceError } from './public-menu.service';

const publicationId = 'publication-id';
const categoryId = 'category-id';

interface SnapshotProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  promotionalPrice: string | null;
  ingredients: string | null;
  allergens: string | null;
  availability: 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE' | 'HIDDEN';
  featured: boolean;
  displayOrder: number;
}

interface SnapshotFixture {
  schemaVersion: number;
  establishment: Record<string, unknown>;
  menu: { name: string };
  categories: Array<{ id: string; name: string; description: string | null }>;
  products: SnapshotProduct[];
  media: Array<Record<string, unknown>>;
}

function snapshot(): SnapshotFixture {
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
      status: 'ACTIVE',
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
      status: 'ACTIVE',
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

  it('searches name, description and category within the active publication', async () => {
    const searchableSnapshot = snapshot();
    searchableSnapshot.categories = [
      { id: categoryId, name: 'Pratos', description: null },
      { id: 'dessert-category', name: 'Sobremesas', description: 'Doces da casa' },
    ];
    searchableSnapshot.products = [
      ...searchableSnapshot.products,
      {
        id: 'product-dessert',
        categoryId: 'dessert-category',
        name: 'Torta da tarde',
        description: 'Sobremesa feita na hora',
        price: '18.00',
        promotionalPrice: null,
        ingredients: null,
        allergens: null,
        availability: 'AVAILABLE',
        featured: false,
        displayOrder: 3,
      },
    ];
    jest.spyOn(prisma.establishment, 'findFirst').mockResolvedValue({
      id: 'establishment-id',
      organizationId: 'organization-id',
      status: 'ACTIVE',
    } as never);
    jest.spyOn(prisma.menu, 'findMany').mockResolvedValue([
      {
        activePublicationId: publicationId,
        activePublication: {
          id: publicationId,
          version: 4,
          publishedAt: new Date('2026-08-09T12:00:00.000Z'),
          snapshot: searchableSnapshot,
        },
      },
    ] as never);

    const result = await new PublicMenuService(createStorage()).getPage('public-id', {
      limit: 6,
      search: 'SOBREMESAS',
    });

    expect(result.products.map((product) => product.id)).toEqual(['product-dessert']);
    expect(result.categories).toEqual([
      { id: 'dessert-category', name: 'Sobremesas', description: 'Doces da casa' },
    ]);
  });

  it('returns deterministic related available products from the published snapshot', async () => {
    const relatedSnapshot = snapshot();
    relatedSnapshot.products = [
      ...relatedSnapshot.products,
      {
        id: 'product-same-category',
        categoryId,
        name: 'Acompanhamento',
        description: null,
        price: '12.00',
        promotionalPrice: null,
        ingredients: null,
        allergens: null,
        availability: 'AVAILABLE',
        featured: false,
        displayOrder: 4,
      },
      {
        id: 'product-other-category',
        categoryId: 'other-category',
        name: 'Bebida',
        description: null,
        price: '8.00',
        promotionalPrice: null,
        ingredients: null,
        allergens: null,
        availability: 'AVAILABLE',
        featured: false,
        displayOrder: 5,
      },
      {
        id: 'product-unavailable',
        categoryId,
        name: 'Indisponível',
        description: null,
        price: '9.00',
        promotionalPrice: null,
        ingredients: null,
        allergens: null,
        availability: 'TEMPORARILY_UNAVAILABLE',
        featured: true,
        displayOrder: 1,
      },
    ];
    jest.spyOn(prisma.establishment, 'findFirst').mockResolvedValue({
      id: 'establishment-id',
      organizationId: 'organization-id',
      status: 'ACTIVE',
    } as never);
    jest.spyOn(prisma.menu, 'findMany').mockResolvedValue([
      {
        activePublicationId: publicationId,
        activePublication: {
          id: publicationId,
          version: 4,
          publishedAt: new Date('2026-08-09T12:00:00.000Z'),
          snapshot: relatedSnapshot,
        },
      },
    ] as never);

    const result = await new PublicMenuService(createStorage()).getRelated(
      'public-id',
      'product-1',
    );

    expect(result.products.map((product) => product.id)).toEqual([
      'product-same-category',
      'product-other-category',
    ]);
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
      status: 'ACTIVE',
    } as never);
    jest.spyOn(prisma.menu, 'findMany').mockResolvedValue(menus as never);

    await expect(
      new PublicMenuService(createStorage()).getPage('public-id', { limit: 6 }),
    ).rejects.toMatchObject({ code });
  });
});
