import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  EstablishmentAddress,
  EstablishmentOperatingHours,
  EstablishmentThemeSettings,
  PublicEstablishmentResponse,
  PublicMenuCategoryResponse,
  PublicMenuMediaResponse,
  PublicMenuPageResponse,
  PublicMenuProductResponse,
  PublicProductAvailability,
  StorageService,
} from '@pratto/contracts';
import { STORAGE_SERVICE } from '@pratto/contracts';
import { prisma } from '@pratto/database';
import { publicMenuCursorSchema, type PublicMenuQuery } from '@pratto/validation';
import { z } from 'zod';

import { StableHttpException } from '../../../common/http/stable-http.exception';

const publicSnapshotSchema = z.object({
  schemaVersion: z.number(),
  establishment: z.object({
    publicId: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    address: z.unknown().nullable(),
    operatingHours: z.unknown(),
    logo: z.object({ storageKey: z.string(), contentType: z.string().nullable() }).nullable(),
    coverImage: z.object({ storageKey: z.string(), contentType: z.string().nullable() }).nullable(),
    theme: z.unknown(),
  }),
  menu: z.object({ name: z.string() }),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
  products: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      price: z.string(),
      promotionalPrice: z.string().nullable(),
      ingredients: z.string().nullable(),
      allergens: z.string().nullable(),
      availability: z.enum(['AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN']),
      featured: z.boolean(),
      displayOrder: z.number(),
    }),
  ),
  media: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      mediaType: z.enum(['IMAGE', 'VIDEO']),
      contentType: z.string(),
      storageKey: z.string(),
      displayOrder: z.number(),
      isPrimary: z.boolean(),
    }),
  ),
});

type PublicSnapshot = z.infer<typeof publicSnapshotSchema>;
type PublicMenuErrorCode =
  | 'PUBLIC_MENU_NOT_FOUND'
  | 'PUBLIC_MENU_NOT_PUBLISHED'
  | 'PUBLIC_MENU_CONFIGURATION_INVALID'
  | 'PUBLIC_MENU_CATEGORY_NOT_FOUND'
  | 'PUBLIC_MENU_CURSOR_INVALID'
  | 'PUBLIC_MENU_CURSOR_STALE'
  | 'PUBLIC_MENU_SNAPSHOT_INVALID';

interface CursorValue {
  publicationId: string;
  productId: string;
}

export class PublicMenuServiceError extends Error {
  constructor(
    public readonly code: PublicMenuErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PublicMenuServiceError';
  }
}

@Injectable()
export class PublicMenuService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async getPage(publicId: string, query: PublicMenuQuery): Promise<PublicMenuPageResponse> {
    const establishment = await prisma.establishment.findFirst({
      where: { publicId, status: 'ACTIVE' },
      select: { id: true, organizationId: true },
    });
    if (!establishment) this.fail('PUBLIC_MENU_NOT_FOUND', 'Cardápio não encontrado.');

    const menus = await prisma.menu.findMany({
      where: {
        establishmentId: establishment.id,
        organizationId: establishment.organizationId,
        status: 'ACTIVE',
        activePublicationId: { not: null },
      },
      select: {
        activePublicationId: true,
        activePublication: {
          select: { id: true, version: true, publishedAt: true, snapshot: true },
        },
      },
    });
    const activeMenus = menus.filter((menu) => menu.activePublication !== null);
    if (activeMenus.length === 0) {
      this.fail('PUBLIC_MENU_NOT_PUBLISHED', 'Este cardápio ainda não foi publicado.');
    }
    if (activeMenus.length > 1) {
      this.fail(
        'PUBLIC_MENU_CONFIGURATION_INVALID',
        'O cardápio público está temporariamente indisponível.',
      );
    }

    const activeMenu = activeMenus[0];
    const publication = activeMenu?.activePublication;
    if (!publication || !activeMenu.activePublicationId) {
      this.fail('PUBLIC_MENU_NOT_PUBLISHED', 'Este cardápio ainda não foi publicado.');
    }

    const snapshot = this.parseSnapshot(publication.snapshot);
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    if (cursor && cursor.publicationId !== publication.id) {
      this.fail(
        'PUBLIC_MENU_CURSOR_STALE',
        'A publicação mudou. Recarregue o cardápio para continuar.',
      );
    }

    const allVisibleProducts = snapshot.products.filter(
      (product) => product.availability !== 'HIDDEN',
    );
    const category = query.categoryId
      ? snapshot.categories.find((item) => item.id === query.categoryId)
      : undefined;
    if (query.categoryId && !category) {
      this.fail('PUBLIC_MENU_CATEGORY_NOT_FOUND', 'A categoria não foi encontrada.');
    }

    const visibleCategoryIds = new Set(allVisibleProducts.map((product) => product.categoryId));
    const categories = snapshot.categories
      .filter((item) => visibleCategoryIds.has(item.id))
      .map<PublicMenuCategoryResponse>((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      }));
    const filteredProducts = query.categoryId
      ? allVisibleProducts.filter((product) => product.categoryId === query.categoryId)
      : allVisibleProducts;
    const startIndex = cursor
      ? this.findCursorProductIndex(filteredProducts, cursor.productId) + 1
      : 0;
    const pageProducts = filteredProducts.slice(startIndex, startIndex + query.limit);
    const products = await Promise.all(
      pageProducts.map((product) => this.toProduct(snapshot, product.id)),
    );
    const lastProduct = pageProducts.at(-1);
    const nextCursor =
      lastProduct && startIndex + pageProducts.length < filteredProducts.length
        ? this.encodeCursor({ publicationId: publication.id, productId: lastProduct.id })
        : null;

    return {
      establishment: await this.toEstablishment(publicId, snapshot.establishment),
      menu: {
        name: snapshot.menu.name,
        publicationId: publication.id,
        version: publication.version,
        publishedAt: publication.publishedAt.toISOString(),
      },
      categories,
      products,
      nextCursor,
    };
  }

  private async toEstablishment(
    publicId: string,
    establishment: PublicSnapshot['establishment'],
  ): Promise<PublicEstablishmentResponse> {
    return {
      publicId,
      name: establishment.name,
      slug: establishment.slug,
      description: establishment.description,
      phone: establishment.phone,
      whatsapp: establishment.whatsapp,
      address: establishment.address as EstablishmentAddress | null,
      operatingHours: establishment.operatingHours as EstablishmentOperatingHours,
      logo: establishment.logo ? await this.toAsset(establishment.logo) : null,
      coverImage: establishment.coverImage ? await this.toAsset(establishment.coverImage) : null,
      theme: establishment.theme as EstablishmentThemeSettings,
    };
  }

  private async toAsset(asset: {
    storageKey: string;
    contentType: string | null;
  }): Promise<{ url: string; contentType: string }> {
    return {
      url: await this.storage.getReadUrl(asset.storageKey),
      contentType: asset.contentType ?? 'application/octet-stream',
    };
  }

  private async toProduct(
    snapshot: PublicSnapshot,
    productId: string,
  ): Promise<PublicMenuProductResponse> {
    const product = snapshot.products.find((item) => item.id === productId);
    if (!product || product.availability === 'HIDDEN') {
      this.fail('PUBLIC_MENU_CURSOR_INVALID', 'O cursor do cardápio é inválido.');
    }
    const media = snapshot.media
      .filter((item) => item.productId === product.id)
      .sort(
        (left, right) =>
          Number(right.isPrimary) - Number(left.isPrimary) ||
          left.displayOrder - right.displayOrder ||
          left.id.localeCompare(right.id),
      );
    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      promotionalPrice: product.promotionalPrice,
      ingredients: product.ingredients,
      allergens: product.allergens,
      availability: product.availability as PublicProductAvailability,
      featured: product.featured,
      media: await Promise.all(media.map((item) => this.toMedia(item))),
    };
  }

  private async toMedia(media: PublicSnapshot['media'][number]): Promise<PublicMenuMediaResponse> {
    return {
      id: media.id,
      mediaType: media.mediaType,
      contentType: media.contentType,
      url: await this.storage.getReadUrl(media.storageKey),
    };
  }

  private parseSnapshot(value: unknown): PublicSnapshot {
    const result = publicSnapshotSchema.safeParse(value);
    if (result.success && result.data.schemaVersion >= 3) return result.data;
    this.fail(
      'PUBLIC_MENU_SNAPSHOT_INVALID',
      'O cardápio publicado está temporariamente indisponível.',
    );
  }

  private findCursorProductIndex(products: PublicSnapshot['products'], productId: string): number {
    const index = products.findIndex((product) => product.id === productId);
    if (index >= 0) return index;
    this.fail('PUBLIC_MENU_CURSOR_INVALID', 'O cursor do cardápio é inválido.');
  }

  private encodeCursor(value: CursorValue): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private decodeCursor(value: string): CursorValue {
    const parsed = publicMenuCursorSchema.safeParse(value);
    if (!parsed.success)
      this.fail('PUBLIC_MENU_CURSOR_INVALID', 'O cursor do cardápio é inválido.');
    try {
      const decoded = JSON.parse(Buffer.from(parsed.data, 'base64url').toString('utf8')) as unknown;
      if (!isCursorValue(decoded)) {
        this.fail('PUBLIC_MENU_CURSOR_INVALID', 'O cursor do cardápio é inválido.');
      }
      return decoded;
    } catch {
      this.fail('PUBLIC_MENU_CURSOR_INVALID', 'O cursor do cardápio é inválido.');
    }
  }

  private fail(code: PublicMenuErrorCode, message: string): never {
    throw new PublicMenuServiceError(code, message);
  }
}

function isCursorValue(value: unknown): value is CursorValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'publicationId' in value &&
    'productId' in value &&
    typeof value.publicationId === 'string' &&
    typeof value.productId === 'string'
  );
}

export function mapPublicMenuError(error: unknown): never {
  if (!(error instanceof PublicMenuServiceError)) throw error;
  const status =
    error.code === 'PUBLIC_MENU_NOT_FOUND' || error.code === 'PUBLIC_MENU_NOT_PUBLISHED'
      ? HttpStatus.NOT_FOUND
      : error.code === 'PUBLIC_MENU_CONFIGURATION_INVALID' ||
          error.code === 'PUBLIC_MENU_CURSOR_STALE'
        ? HttpStatus.CONFLICT
        : error.code === 'PUBLIC_MENU_CATEGORY_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : error.code === 'PUBLIC_MENU_CURSOR_INVALID'
            ? HttpStatus.BAD_REQUEST
            : HttpStatus.SERVICE_UNAVAILABLE;
  throw new StableHttpException(status, error.code, error.message);
}
