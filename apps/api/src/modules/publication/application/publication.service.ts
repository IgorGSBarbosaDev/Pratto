import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ActiveMenuPublicationResponse,
  MenuPublicationHistoryResponse,
  MenuPublicationResponse,
} from '@pratto/contracts';
import {
  MenuPublicationService as DatabasePublicationService,
  MenuPublicationServiceError,
  prisma,
} from '@pratto/database';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { CatalogMenuSnapshotSource } from '../../catalog/application/catalog-menu-snapshot-source';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

@Injectable()
export class PublicationService {
  private readonly databaseService: DatabasePublicationService;

  constructor(@Inject(CatalogMenuSnapshotSource) snapshotSource: CatalogMenuSnapshotSource) {
    this.databaseService = new DatabasePublicationService(prisma, snapshotSource);
  }

  async publish(
    tenant: TenantPrincipal,
    menuId: string,
    idempotencyKey: string,
  ): Promise<MenuPublicationResponse> {
    try {
      const publication = await this.databaseService.publish({
        menuId,
        tenant,
        idempotencyKey,
      });
      return toPublicationResponse(publication);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getActive(tenant: TenantPrincipal, menuId: string): Promise<ActiveMenuPublicationResponse> {
    try {
      const state = await this.databaseService.getActive({ menuId, tenant });
      return {
        menuId,
        publication: state.publication ? toPublicationResponse(state.publication) : null,
        hasUnpublishedChanges: state.hasUnpublishedChanges,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async listHistory(
    tenant: TenantPrincipal,
    menuId: string,
  ): Promise<MenuPublicationHistoryResponse> {
    try {
      const publications = await this.databaseService.listHistory({ menuId, tenant });
      return {
        menuId,
        publications: publications.map((publication) => ({
          id: publication.id,
          menuId: publication.menuId,
          version: publication.version,
          publishedAt: publication.publishedAt.toISOString(),
          publishedBy: publication.publishedBy,
        })),
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof MenuPublicationServiceError) {
      const status =
        error.code === 'PUBLICATION_ACCESS_DENIED'
          ? HttpStatus.FORBIDDEN
          : error.code === 'MENU_NOT_FOUND'
            ? HttpStatus.NOT_FOUND
            : error.code === 'MENU_ARCHIVED'
              ? HttpStatus.CONFLICT
              : error.code === 'PUBLICATION_STATE_UNAVAILABLE'
                ? HttpStatus.SERVICE_UNAVAILABLE
                : HttpStatus.BAD_REQUEST;
      throw new StableHttpException(status, error.code, error.message);
    }

    if (hasDatabaseCode(error, 'P2002') || hasDatabaseCode(error, 'P2034')) {
      throw new StableHttpException(
        HttpStatus.CONFLICT,
        'PUBLICATION_CONFLICT',
        'Outra publicação foi concluída simultaneamente. Tente novamente.',
      );
    }

    throw error;
  }
}

function toPublicationResponse(publication: {
  id: string;
  menuId: string;
  version: number;
  snapshot: unknown;
  publishedAt: Date;
  publishedBy: string;
}): MenuPublicationResponse {
  return {
    id: publication.id,
    menuId: publication.menuId,
    version: publication.version,
    snapshot: isRecord(publication.snapshot) ? publication.snapshot : {},
    publishedAt: publication.publishedAt.toISOString(),
    publishedBy: publication.publishedBy,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
