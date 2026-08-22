import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { AnalyticsDashboardResponse } from '@pratto/contracts';

import { PermissionGuard } from '../../authorization/presentation/permission.guard';
import type { TenantPrincipal } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import type { AnalyticsDashboardService } from '../application/analytics-dashboard.service';

import { AnalyticsDashboardController } from './analytics-dashboard.controller';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const tenant = {
  organizationId: '33333333-3333-4333-8333-333333333333',
  establishmentIds: [establishmentId],
} as TenantPrincipal;
const response = {} as AnalyticsDashboardResponse;

describe('AnalyticsDashboardController', () => {
  it('declares authentication and organization guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalyticsDashboardController)).toEqual([
      AuthenticatedGuard,
      OrganizationGuard,
      PermissionGuard,
    ]);
  });

  it('rejects invalid period input before calling the service', () => {
    const getDashboard = jest.fn();
    const controller = new AnalyticsDashboardController({
      getDashboard,
    } as unknown as AnalyticsDashboardService);

    expect(() =>
      controller.getDashboard(
        establishmentId,
        { from: 'invalid', to: '2026-08-10T00:00:00.000Z' },
        { tenant } as never,
      ),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('rejects periods longer than 366 days before calling the service', () => {
    const getDashboard = jest.fn();
    const controller = new AnalyticsDashboardController({
      getDashboard,
    } as unknown as AnalyticsDashboardService);

    expect(() =>
      controller.getDashboard(
        establishmentId,
        { from: '2025-01-01T00:00:00.000Z', to: '2026-01-03T00:00:00.000Z' },
        { tenant } as never,
      ),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('passes the resolved tenant, establishment and filters to the service', async () => {
    const getDashboard = jest.fn().mockResolvedValue(response);
    const controller = new AnalyticsDashboardController({
      getDashboard,
    } as unknown as AnalyticsDashboardService);
    const query = {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-10T00:00:00.000Z',
      categoryId,
    };

    await expect(
      controller.getDashboard(establishmentId, query, { tenant } as never),
    ).resolves.toBe(response);
    expect(getDashboard).toHaveBeenCalledWith(tenant, establishmentId, query);
  });
});
