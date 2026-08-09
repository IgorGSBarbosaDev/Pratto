import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ProductMediaListResponse,
  ProductMediaResponse,
  ProductMediaReorderInput,
  ProductMediaType,
  StorageService,
} from '@pratto/contracts';
import { STORAGE_SERVICE } from '@pratto/contracts';
import { prisma } from '@pratto/database';
import type { Prisma } from '@pratto/database';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_PRODUCT_MEDIA_SIZE_BYTES = MAX_PRODUCT_VIDEO_SIZE_BYTES;

export interface ProductMediaUploadFile {
  buffer: Uint8Array;
  mimetype: string;
  originalname: string;
  size: number;
}

const mediaSelect = {
  id: true,
  organizationId: true,
  menuId: true,
  productId: true,
  mediaType: true,
  contentType: true,
  originalName: true,
  storageKey: true,
  sizeBytes: true,
  displayOrder: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductMediaSelect;

type ProductMediaRecord = Prisma.ProductMediaGetPayload<{ select: typeof mediaSelect }>;
type DatabaseClient = Prisma.TransactionClient | typeof prisma;

type MediaRule = {
  mediaType: ProductMediaType;
  extension: string;
  extensions: ReadonlySet<string>;
  maxSizeBytes: number;
};

const MEDIA_RULES: ReadonlyMap<string, MediaRule> = new Map([
  [
    'image/jpeg',
    {
      mediaType: 'IMAGE',
      extension: 'jpg',
      extensions: new Set(['jpg', 'jpeg']),
      maxSizeBytes: MAX_PRODUCT_IMAGE_SIZE_BYTES,
    },
  ],
  [
    'image/png',
    {
      mediaType: 'IMAGE',
      extension: 'png',
      extensions: new Set(['png']),
      maxSizeBytes: MAX_PRODUCT_IMAGE_SIZE_BYTES,
    },
  ],
  [
    'image/webp',
    {
      mediaType: 'IMAGE',
      extension: 'webp',
      extensions: new Set(['webp']),
      maxSizeBytes: MAX_PRODUCT_IMAGE_SIZE_BYTES,
    },
  ],
  [
    'video/mp4',
    {
      mediaType: 'VIDEO',
      extension: 'mp4',
      extensions: new Set(['mp4']),
      maxSizeBytes: MAX_PRODUCT_VIDEO_SIZE_BYTES,
    },
  ],
  [
    'video/webm',
    {
      mediaType: 'VIDEO',
      extension: 'webm',
      extensions: new Set(['webm']),
      maxSizeBytes: MAX_PRODUCT_VIDEO_SIZE_BYTES,
    },
  ],
  [
    'video/quicktime',
    {
      mediaType: 'VIDEO',
      extension: 'mov',
      extensions: new Set(['mov']),
      maxSizeBytes: MAX_PRODUCT_VIDEO_SIZE_BYTES,
    },
  ],
]);

const MEDIA_MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);

@Injectable()
export class ProductMediaService {
  private readonly database = prisma;

  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async listMedia(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
  ): Promise<ProductMediaListResponse> {
    await this.findProduct(tenant.organizationId, menuId, productId);
    const media = await this.database.productMedia.findMany({
      where: { organizationId: tenant.organizationId, menuId, productId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: mediaSelect,
    });
    return { productId, media: await Promise.all(media.map((item) => this.toResponse(item))) };
  }

  async uploadMedia(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
    file: ProductMediaUploadFile | undefined,
  ): Promise<ProductMediaResponse> {
    this.assertCanManage(tenant);
    const product = await this.findProduct(tenant.organizationId, menuId, productId);
    if (product.archivedAt) this.productArchived();
    const validated = this.validateFile(file);
    const key = `product-media/${tenant.organizationId}/${menuId}/${productId}/${randomUUID()}.${validated.rule.extension}`;
    const stored = await this.storage.upload({
      key,
      body: validated.file.buffer,
      contentType: validated.contentType,
      contentLength: validated.sizeBytes,
    });

    try {
      const created = await this.database.$transaction(async (transaction) => {
        await this.lockProduct(transaction, tenant, menuId, productId);
        const latest = await transaction.productMedia.aggregate({
          where: { organizationId: tenant.organizationId, menuId, productId },
          _max: { displayOrder: true },
        });
        const primary = await transaction.productMedia.findFirst({
          where: { organizationId: tenant.organizationId, menuId, productId, isPrimary: true },
          select: { id: true },
        });
        return transaction.productMedia.create({
          data: {
            organizationId: tenant.organizationId,
            menuId,
            productId,
            mediaType: validated.rule.mediaType,
            contentType: validated.contentType,
            originalName: validated.originalName,
            storageKey: stored.key,
            sizeBytes: validated.sizeBytes,
            displayOrder: (latest._max.displayOrder ?? -1) + 1,
            isPrimary: !primary,
          },
          select: mediaSelect,
        });
      });
      return await this.toResponse(created);
    } catch (error) {
      await this.deleteStoredAsset(stored.key);
      throw error;
    }
  }

  async setPrimary(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
    mediaId: string,
  ): Promise<ProductMediaListResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockProduct(transaction, tenant, menuId, productId);
      const media = await this.findMedia(
        transaction,
        tenant.organizationId,
        menuId,
        productId,
        mediaId,
      );
      await transaction.productMedia.updateMany({
        where: { organizationId: tenant.organizationId, menuId, productId },
        data: { isPrimary: false },
      });
      await transaction.productMedia.update({
        where: { id_organizationId: { id: media.id, organizationId: tenant.organizationId } },
        data: { isPrimary: true },
      });
      return this.listMediaWithClient(transaction, tenant.organizationId, productId, menuId);
    });
  }

  async removeMedia(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
    mediaId: string,
  ): Promise<ProductMediaListResponse> {
    this.assertCanManage(tenant);
    let removedKey: string | undefined;
    const result = await this.database.$transaction(async (transaction) => {
      await this.lockProduct(transaction, tenant, menuId, productId);
      const media = await this.findMedia(
        transaction,
        tenant.organizationId,
        menuId,
        productId,
        mediaId,
      );
      removedKey = media.storageKey;
      await transaction.productMedia.delete({
        where: { id_organizationId: { id: media.id, organizationId: tenant.organizationId } },
      });

      const remaining = await transaction.productMedia.findMany({
        where: { organizationId: tenant.organizationId, menuId, productId },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: mediaSelect,
      });
      for (const [displayOrder, item] of remaining.entries()) {
        await transaction.productMedia.update({
          where: { id_organizationId: { id: item.id, organizationId: tenant.organizationId } },
          data: {
            displayOrder,
            ...(media.isPrimary && displayOrder === 0 ? { isPrimary: true } : {}),
          },
        });
      }
      return this.listMediaWithClient(transaction, tenant.organizationId, productId, menuId);
    });
    if (removedKey) await this.deleteStoredAsset(removedKey);
    return result;
  }

  async reorderMedia(
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
    input: ProductMediaReorderInput,
  ): Promise<ProductMediaListResponse> {
    this.assertCanManage(tenant);
    return this.database.$transaction(async (transaction) => {
      await this.lockProduct(transaction, tenant, menuId, productId);
      const media = await transaction.productMedia.findMany({
        where: { organizationId: tenant.organizationId, menuId, productId },
        select: { id: true },
      });
      this.assertCompleteReorder(input, media);
      for (const [displayOrder, mediaId] of input.mediaIds.entries()) {
        await transaction.productMedia.update({
          where: { id_organizationId: { id: mediaId, organizationId: tenant.organizationId } },
          data: { displayOrder },
        });
      }
      return this.listMediaWithClient(transaction, tenant.organizationId, productId, menuId);
    });
  }

  private async findProduct(
    organizationId: string,
    menuId: string,
    productId: string,
  ): Promise<{
    id: string;
    organizationId: string;
    menuId: string;
    status: string;
    archivedAt: Date | null;
  }> {
    const product = await this.database.product.findFirst({
      where: { id: productId, organizationId, menuId },
      select: { id: true, organizationId: true, menuId: true, status: true, archivedAt: true },
    });
    if (!product) this.productNotFound();
    return product;
  }

  private async lockProduct(
    database: DatabaseClient,
    tenant: TenantPrincipal,
    menuId: string,
    productId: string,
  ): Promise<void> {
    const products = await database.$queryRaw<
      Array<{ id: string; status: string; archived_at: Date | null }>
    >`
      SELECT "id", "status", "archived_at"
      FROM "products"
      WHERE "id" = ${productId}::uuid
        AND "menu_id" = ${menuId}::uuid
        AND "organization_id" = ${tenant.organizationId}::uuid
      FOR UPDATE
    `;
    const product = products[0];
    if (!product) this.productNotFound();
    if (product.archived_at) this.productArchived();
  }

  private async findMedia(
    database: DatabaseClient,
    organizationId: string,
    menuId: string,
    productId: string,
    mediaId: string,
  ): Promise<ProductMediaRecord> {
    const media = await database.productMedia.findFirst({
      where: { id: mediaId, organizationId, menuId, productId },
      select: mediaSelect,
    });
    if (!media) this.mediaNotFound();
    return media;
  }

  private async listMediaWithClient(
    database: DatabaseClient,
    organizationId: string,
    productId: string,
    menuId: string,
  ): Promise<ProductMediaListResponse> {
    const media = await database.productMedia.findMany({
      where: { organizationId, menuId, productId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: mediaSelect,
    });
    return { productId, media: await Promise.all(media.map((item) => this.toResponse(item))) };
  }

  private validateFile(file: ProductMediaUploadFile | undefined): {
    file: ProductMediaUploadFile;
    rule: MediaRule;
    contentType: string;
    sizeBytes: number;
    originalName: string;
  } {
    if (!file || !file.buffer || file.buffer.byteLength === 0) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_MEDIA_FILE_REQUIRED',
        'Envie uma imagem ou vídeo para o produto.',
      );
    }
    const contentType = file.mimetype.trim().toLowerCase();
    const rule = MEDIA_RULES.get(contentType);
    if (!rule) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_MEDIA_TYPE_INVALID',
        'Use uma imagem JPEG, PNG ou WebP, ou um vídeo MP4, WebM ou MOV.',
      );
    }
    const sizeBytes = file.buffer.byteLength;
    if (sizeBytes !== file.size || sizeBytes > rule.maxSizeBytes) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_MEDIA_SIZE_INVALID',
        `O arquivo deve ter entre 1 byte e ${formatBytes(rule.maxSizeBytes)}.`,
      );
    }
    const originalName = cleanOriginalName(file.originalname);
    const extension = extensionOf(originalName);
    if (!rule.extensions.has(extension)) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_MEDIA_EXTENSION_INVALID',
        'A extensão do arquivo não corresponde ao tipo de mídia permitido.',
      );
    }
    if (!hasValidSignature(file.buffer, contentType)) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_MEDIA_CONTENT_INVALID',
        'O conteúdo do arquivo não corresponde ao MIME informado.',
      );
    }
    return { file, rule, contentType, sizeBytes, originalName };
  }

  private assertCompleteReorder(
    input: ProductMediaReorderInput,
    media: ReadonlyArray<{ id: string }>,
  ): void {
    const currentIds = new Set(media.map((item) => item.id));
    const requestedIds = new Set(input.mediaIds);
    if (
      requestedIds.size !== input.mediaIds.length ||
      requestedIds.size !== currentIds.size ||
      input.mediaIds.some((mediaId) => !currentIds.has(mediaId))
    ) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_MEDIA_REORDER_INVALID',
        'A reordenação deve informar exatamente todas as mídias do produto, uma única vez.',
      );
    }
  }

  private assertCanManage(tenant: TenantPrincipal): void {
    if (!MEDIA_MANAGER_ROLES.has(tenant.role)) {
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'PRODUCT_MEDIA_MANAGEMENT_ACCESS_DENIED',
        'Apenas proprietários e administradores podem gerenciar mídias de produtos.',
      );
    }
  }

  private async toResponse(media: ProductMediaRecord): Promise<ProductMediaResponse> {
    return {
      id: media.id,
      productId: media.productId,
      mediaType: media.mediaType as ProductMediaType,
      contentType: media.contentType,
      originalName: media.originalName,
      url: await this.storage.getReadUrl(media.storageKey),
      sizeBytes: media.sizeBytes,
      displayOrder: media.displayOrder,
      isPrimary: media.isPrimary,
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    };
  }

  private async deleteStoredAsset(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch {
      // A referência do banco é a fonte de verdade; o objeto pode ser removido por limpeza posterior.
    }
  }

  private productNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'PRODUCT_NOT_FOUND',
      'Produto não encontrado neste menu.',
    );
  }

  private productArchived(): never {
    throw new StableHttpException(
      HttpStatus.CONFLICT,
      'PRODUCT_ARCHIVED',
      'Produtos arquivados não podem receber mídias.',
    );
  }

  private mediaNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'PRODUCT_MEDIA_NOT_FOUND',
      'Mídia não encontrada neste produto.',
    );
  }
}

function cleanOriginalName(value: string): string {
  const normalized = value.replaceAll('\\', '/').split('/').pop()?.trim() ?? '';
  if (normalized.length === 0 || normalized.length > 255) {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'PRODUCT_MEDIA_NAME_INVALID',
      'O nome original do arquivo é inválido.',
    );
  }
  return normalized;
}

function extensionOf(name: string): string {
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  return extension.toLowerCase();
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)} MB` : `${bytes} bytes`;
}

function hasValidSignature(buffer: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg')
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === 'image/png')
    return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === 'image/webp')
    return asciiAt(buffer, 0, 4) === 'RIFF' && asciiAt(buffer, 8, 4) === 'WEBP';
  if (contentType === 'video/webm') return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
  if (contentType === 'video/mp4' || contentType === 'video/quicktime')
    return asciiAt(buffer, 4, 4) === 'ftyp';
  return false;
}

function startsWith(buffer: Uint8Array, signature: number[]): boolean {
  return (
    buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte)
  );
}

function asciiAt(buffer: Uint8Array, offset: number, length: number): string {
  if (buffer.length < offset + length) return '';
  return String.fromCharCode(...buffer.slice(offset, offset + length));
}
