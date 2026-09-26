import type { MenuSnapshotInput } from '@pratto/database';
import { DEFAULT_ESTABLISHMENT_OPERATING_HOURS } from '@pratto/validation';

import { CatalogMenuSnapshotSource } from './catalog-menu-snapshot-source';

describe('CatalogMenuSnapshotSource', () => {
  it('snapshots the editable menu in the requested tenant shape', async () => {
    const findFirstOrThrow = jest.fn().mockResolvedValue({
      id: 'menu-id',
      name: 'Menu principal',
      establishment: {
        id: 'establishment-id',
        publicId: 'establishment-public-id',
        name: 'Estabelecimento principal',
        slug: 'estabelecimento-principal',
        description: 'Descrição pública',
        phone: '3133334444',
        whatsapp: '5531999999999',
        address: { city: 'Belo Horizonte' },
        operatingHours: DEFAULT_ESTABLISHMENT_OPERATING_HOURS,
        timeZone: 'America/Sao_Paulo',
        logoKey: 'establishments/logo.png',
        logoContentType: 'image/png',
        coverImageKey: 'establishments/cover.webp',
        coverImageContentType: 'image/webp',
        themeSettings: { mode: 'LIGHT', primaryColor: '#166534' },
      },
    });
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'category-id',
        name: 'Entradas',
        description: 'Para começar',
        displayOrder: 0,
      },
    ]);
    const productFindMany = jest.fn().mockResolvedValue([
      {
        id: 'product-id',
        categoryId: 'category-id',
        name: 'Hambúrguer clássico',
        description: 'Pão, carne e queijo',
        price: '29.90',
        promotionalPrice: '24.90',
        ingredients: 'Carne, pão e queijo',
        allergens: 'Glúten, leite',
        availability: 'AVAILABLE',
        featured: true,
        displayOrder: 0,
      },
    ]);
    const mediaFindMany = jest.fn().mockResolvedValue([]);
    const transaction = {
      menu: { findFirstOrThrow },
      category: { findMany },
      product: { findMany: productFindMany },
      productMedia: { findMany: mediaFindMany },
    } as unknown as MenuSnapshotInput['transaction'];

    const snapshot = await new CatalogMenuSnapshotSource().buildSnapshot({
      transaction,
      menuId: 'menu-id',
      organizationId: 'organization-id',
    });

    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'menu-id', organizationId: 'organization-id' },
      select: {
        id: true,
        name: true,
        establishment: {
          select: {
            id: true,
            publicId: true,
            name: true,
            slug: true,
            description: true,
            phone: true,
            whatsapp: true,
            address: true,
            operatingHours: true,
            timeZone: true,
            logoKey: true,
            logoContentType: true,
            coverImageKey: true,
            coverImageContentType: true,
            themeSettings: true,
          },
        },
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        menuId: 'menu-id',
        organizationId: 'organization-id',
        status: 'ACTIVE',
        archivedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, description: true, displayOrder: true },
    });
    expect(productFindMany).toHaveBeenCalledWith({
      where: {
        menuId: 'menu-id',
        organizationId: 'organization-id',
        status: 'ACTIVE',
        archivedAt: null,
        category: { status: 'ACTIVE', archivedAt: null },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        promotionalPrice: true,
        ingredients: true,
        allergens: true,
        availability: true,
        featured: true,
        displayOrder: true,
      },
    });
    expect(mediaFindMany).toHaveBeenCalledWith({
      where: {
        menuId: 'menu-id',
        organizationId: 'organization-id',
        productId: { in: ['product-id'] },
      },
      orderBy: [{ productId: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        productId: true,
        mediaType: true,
        contentType: true,
        storageKey: true,
        displayOrder: true,
        isPrimary: true,
      },
    });
    expect(snapshot).toEqual({
      schemaVersion: 4,
      establishment: {
        id: 'establishment-id',
        publicId: 'establishment-public-id',
        name: 'Estabelecimento principal',
        slug: 'estabelecimento-principal',
        description: 'Descrição pública',
        phone: '3133334444',
        whatsapp: '5531999999999',
        address: { city: 'Belo Horizonte' },
        operatingHours: DEFAULT_ESTABLISHMENT_OPERATING_HOURS,
        timeZone: 'America/Sao_Paulo',
        logo: { storageKey: 'establishments/logo.png', contentType: 'image/png' },
        coverImage: {
          storageKey: 'establishments/cover.webp',
          contentType: 'image/webp',
        },
        theme: { mode: 'LIGHT', primaryColor: '#166534' },
      },
      menu: { id: 'menu-id', name: 'Menu principal' },
      categories: [
        { id: 'category-id', name: 'Entradas', description: 'Para começar', displayOrder: 0 },
      ],
      products: [
        {
          id: 'product-id',
          categoryId: 'category-id',
          name: 'Hambúrguer clássico',
          description: 'Pão, carne e queijo',
          price: '29.90',
          promotionalPrice: '24.90',
          ingredients: 'Carne, pão e queijo',
          allergens: 'Glúten, leite',
          availability: 'AVAILABLE',
          featured: true,
          displayOrder: 0,
        },
      ],
      media: [],
    });
  });

  it('includes product media in a new snapshot using the immutable storage key', async () => {
    const transaction = {
      menu: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'menu-id',
          name: 'Menu principal',
          establishment: {
            id: 'establishment-id',
            publicId: 'establishment-public-id',
            name: 'Estabelecimento principal',
            slug: 'estabelecimento-principal',
            description: null,
            phone: null,
            whatsapp: null,
            address: null,
            operatingHours: {},
            timeZone: 'America/Sao_Paulo',
            logoKey: null,
            logoContentType: null,
            coverImageKey: null,
            coverImageContentType: null,
            themeSettings: { mode: 'LIGHT', primaryColor: '#166534' },
          },
        }),
      },
      category: { findMany: jest.fn().mockResolvedValue([]) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product-id',
            categoryId: 'category-id',
            name: 'Produto',
            description: null,
            price: '10.00',
            promotionalPrice: null,
            ingredients: null,
            allergens: null,
            availability: 'AVAILABLE',
            featured: false,
            displayOrder: 0,
          },
        ]),
      },
      productMedia: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'media-id',
            productId: 'product-id',
            mediaType: 'IMAGE',
            contentType: 'image/png',
            storageKey: 'product-media/organization-id/menu-id/product-id/image.png',
            displayOrder: 0,
            isPrimary: true,
          },
        ]),
      },
    } as unknown as MenuSnapshotInput['transaction'];
    const snapshot = await new CatalogMenuSnapshotSource().buildSnapshot({
      transaction,
      menuId: 'menu-id',
      organizationId: 'organization-id',
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 4,
      media: [
        {
          id: 'media-id',
          productId: 'product-id',
          mediaType: 'IMAGE',
          contentType: 'image/png',
          storageKey: 'product-media/organization-id/menu-id/product-id/image.png',
          displayOrder: 0,
          isPrimary: true,
        },
      ],
    });
  });
});
