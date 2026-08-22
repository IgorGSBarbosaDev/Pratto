import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  EstablishmentAssetKind,
  EstablishmentSettingsResponse,
  StorageService,
} from '@pratto/contracts';
import { hasPermission, Permission, STORAGE_SERVICE } from '@pratto/contracts';
import { Prisma, prisma } from '@pratto/database';
import {
  DEFAULT_ESTABLISHMENT_OPERATING_HOURS,
  DEFAULT_ESTABLISHMENT_THEME,
  type EstablishmentUpdateInput,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const establishmentSelect = {
  id: true,
  publicId: true,
  name: true,
  slug: true,
  description: true,
  phone: true,
  whatsapp: true,
  address: true,
  operatingHours: true,
  logoKey: true,
  logoContentType: true,
  coverImageKey: true,
  coverImageContentType: true,
  themeSettings: true,
} satisfies Prisma.EstablishmentSelect;

type EstablishmentRecord = Prisma.EstablishmentGetPayload<{ select: typeof establishmentSelect }>;

export interface EstablishmentUploadFile {
  buffer: Uint8Array;
  mimetype: string;
  size: number;
}

@Injectable()
export class EstablishmentService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async getSettings(
    tenant: TenantPrincipal,
    establishmentId: string,
  ): Promise<EstablishmentSettingsResponse> {
    const establishment = await this.findEstablishment(tenant, establishmentId);
    this.assertPermission(tenant, Permission.ESTABLISHMENT_READ);
    return this.toResponse(establishment);
  }

  async updateSettings(
    tenant: TenantPrincipal,
    establishmentId: string,
    input: EstablishmentUpdateInput,
  ): Promise<EstablishmentSettingsResponse> {
    const current = await this.findEstablishment(tenant, establishmentId);
    this.assertPermission(tenant, Permission.ESTABLISHMENT_UPDATE);
    if (Object.keys(input).length === 0) return this.toResponse(current);

    const data: Prisma.EstablishmentUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.description !== undefined) data.description = input.description;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.whatsapp !== undefined) data.whatsapp = input.whatsapp;
    if (input.address !== undefined) {
      data.address =
        input.address === null ? Prisma.DbNull : (input.address as Prisma.InputJsonValue);
    }
    if (input.operatingHours !== undefined) {
      data.operatingHours = input.operatingHours as Prisma.InputJsonValue;
    }
    if (input.theme !== undefined) {
      data.themeSettings = input.theme as Prisma.InputJsonValue;
    }

    try {
      const updated = await prisma.establishment.update({
        where: { id_organizationId: { id: current.id, organizationId: tenant.organizationId } },
        data,
        select: establishmentSelect,
      });
      return this.toResponse(updated);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async uploadAsset(
    tenant: TenantPrincipal,
    establishmentId: string,
    kind: EstablishmentAssetKind,
    file: EstablishmentUploadFile | undefined,
  ): Promise<EstablishmentSettingsResponse> {
    const current = await this.findEstablishment(tenant, establishmentId);
    this.assertPermission(tenant, Permission.ESTABLISHMENT_UPDATE);
    this.validateUpload(file);

    const extension = this.extensionFor(file!.mimetype);
    const key = `establishments/${tenant.organizationId}/${current.id}/${kind}/${randomUUID()}.${extension}`;
    const stored = await this.storage.upload({
      key,
      body: file!.buffer,
      contentType: file!.mimetype,
      contentLength: file!.size,
    });

    const data: Prisma.EstablishmentUpdateInput =
      kind === 'logo'
        ? { logoKey: stored.key, logoContentType: stored.contentType }
        : { coverImageKey: stored.key, coverImageContentType: stored.contentType };

    try {
      const updated = await prisma.establishment.update({
        where: { id_organizationId: { id: current.id, organizationId: tenant.organizationId } },
        data,
        select: establishmentSelect,
      });
      await this.deletePreviousAsset(current, kind);
      return this.toResponse(updated);
    } catch (error) {
      await this.deleteStoredAsset(stored.key);
      this.handlePersistenceError(error);
    }
  }

  async removeAsset(
    tenant: TenantPrincipal,
    establishmentId: string,
    kind: EstablishmentAssetKind,
  ): Promise<EstablishmentSettingsResponse> {
    const current = await this.findEstablishment(tenant, establishmentId);
    this.assertPermission(tenant, Permission.ESTABLISHMENT_UPDATE);
    const oldKey = kind === 'logo' ? current.logoKey : current.coverImageKey;
    const data: Prisma.EstablishmentUpdateInput =
      kind === 'logo'
        ? { logoKey: null, logoContentType: null }
        : { coverImageKey: null, coverImageContentType: null };

    const updated = await prisma.establishment.update({
      where: { id_organizationId: { id: current.id, organizationId: tenant.organizationId } },
      data,
      select: establishmentSelect,
    });
    if (oldKey) await this.deleteStoredAsset(oldKey);
    return this.toResponse(updated);
  }

  private async findEstablishment(
    tenant: TenantPrincipal,
    establishmentId: string,
  ): Promise<EstablishmentRecord> {
    if (!tenant.establishmentIds.includes(establishmentId)) this.notFound();

    const establishment = await prisma.establishment.findFirst({
      where: {
        id: establishmentId,
        organizationId: tenant.organizationId,
        status: 'ACTIVE',
      },
      select: establishmentSelect,
    });
    if (!establishment) this.notFound();
    return establishment;
  }

  private toResponse(record: EstablishmentRecord): EstablishmentSettingsResponse {
    const operatingHours = this.jsonObject(
      record.operatingHours,
      DEFAULT_ESTABLISHMENT_OPERATING_HOURS,
    );
    const theme = this.jsonObject(record.themeSettings, DEFAULT_ESTABLISHMENT_THEME);
    return {
      id: record.id,
      publicId: record.publicId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      phone: record.phone,
      whatsapp: record.whatsapp,
      address:
        record.address && typeof record.address === 'object' && !Array.isArray(record.address)
          ? (record.address as unknown as EstablishmentSettingsResponse['address'])
          : null,
      operatingHours: operatingHours as EstablishmentSettingsResponse['operatingHours'],
      logo: record.logoKey
        ? {
            url: this.storage.getPublicUrl(record.logoKey),
            contentType: record.logoContentType ?? 'application/octet-stream',
          }
        : null,
      coverImage: record.coverImageKey
        ? {
            url: this.storage.getPublicUrl(record.coverImageKey),
            contentType: record.coverImageContentType ?? 'application/octet-stream',
          }
        : null,
      theme: theme as EstablishmentSettingsResponse['theme'],
    };
  }

  private assertPermission(tenant: TenantPrincipal, permission: Permission): void {
    if (hasPermission(tenant.role, permission)) return;
    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'PERMISSION_DENIED',
      'Seu perfil não possui permissão para esta operação.',
      { permission },
    );
  }

  private jsonObject<T>(value: Prisma.JsonValue, fallback: T): T {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    return Object.keys(value).length === 0 ? fallback : (value as T);
  }

  private validateUpload(
    file: EstablishmentUploadFile | undefined,
  ): asserts file is EstablishmentUploadFile {
    if (!file || file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'ESTABLISHMENT_IMAGE_INVALID',
        'A imagem deve ter entre 1 byte e 5 MB.',
      );
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new StableHttpException(
        HttpStatus.BAD_REQUEST,
        'ESTABLISHMENT_IMAGE_TYPE_INVALID',
        'Use uma imagem JPEG, PNG ou WebP.',
      );
    }
  }

  private extensionFor(contentType: string): string {
    if (contentType === 'image/png') return 'png';
    if (contentType === 'image/webp') return 'webp';
    return 'jpg';
  }

  private async deletePreviousAsset(
    current: EstablishmentRecord,
    kind: EstablishmentAssetKind,
  ): Promise<void> {
    const oldKey = kind === 'logo' ? current.logoKey : current.coverImageKey;
    if (oldKey) await this.deleteStoredAsset(oldKey);
  }

  private async deleteStoredAsset(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch {
      // The database reference is already authoritative; an orphan can be cleaned later.
    }
  }

  private handlePersistenceError(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'ESTABLISHMENT_SLUG_ALREADY_IN_USE',
        'Este slug já está sendo usado nesta organização.',
      );
    }
    throw error;
  }

  private notFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'ESTABLISHMENT_NOT_FOUND',
      'Estabelecimento não encontrado.',
    );
  }
}
