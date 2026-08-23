import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

import { AnalyticsDashboardController } from '../../analytics/presentation/analytics-dashboard.controller';
import { CatalogController } from '../../catalog/presentation/catalog.controller';
import { EstablishmentController } from '../../establishments/presentation/establishment.controller';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { ProductMediaController } from '../../media/presentation/product-media.controller';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { PublicationController } from '../../publication/presentation/publication.controller';
import { TeamController } from '../../team/presentation/team.controller';

import { PermissionGuard } from './permission.guard';
import { REQUIRED_PERMISSIONS } from './require-permission.decorator';

const protectedControllers = [
  AnalyticsDashboardController,
  CatalogController,
  EstablishmentController,
  ProductMediaController,
  PublicationController,
  TeamController,
];

describe('protected endpoint authorization coverage', () => {
  it.each(protectedControllers)(
    '%p uses the complete authentication and authorization chain',
    (controller) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([
        AuthenticatedGuard,
        OrganizationGuard,
        PermissionGuard,
      ]);
    },
  );

  it.each(protectedControllers)(
    '%p declares a permission for every route handler',
    (controller) => {
      const prototype = controller.prototype as unknown as Record<string, unknown>;
      const routeHandlers = Object.getOwnPropertyNames(prototype).filter((name) => {
        const handler = prototype[name];
        return typeof handler === 'function' && Reflect.hasMetadata(METHOD_METADATA, handler);
      });

      expect(routeHandlers.length).toBeGreaterThan(0);
      for (const name of routeHandlers) {
        expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, prototype[name] as object)).toBeDefined();
      }
    },
  );
});
