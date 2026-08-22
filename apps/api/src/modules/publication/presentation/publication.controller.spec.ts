import type {
  ActiveMenuPublicationResponse,
  MenuPublicationHistoryResponse,
  MenuPublicationResponse,
} from '@pratto/contracts';

import type { PublicationService } from '../application/publication.service';

import { PublicationController } from './publication.controller';

const menuId = '33333333-3333-4333-8333-333333333333';
const tenant = {
  organizationId: 'organization-a',
  userId: 'user-a',
  role: 'OWNER',
  establishmentIds: ['11111111-1111-4111-8111-111111111111'],
} as never;

const publication = {
  id: '44444444-4444-4444-8444-444444444444',
  menuId,
  version: 1,
  snapshot: { schemaVersion: 3 },
  publishedAt: '2026-08-09T12:00:00.000Z',
  publishedBy: 'user-a',
} as MenuPublicationResponse;

describe('PublicationController', () => {
  it('requires an idempotency key and delegates publication with the session tenant', async () => {
    const publish = jest.fn().mockResolvedValue(publication);
    const controller = new PublicationController({ publish } as unknown as PublicationService);

    await expect(
      controller.publish(menuId, 'publication-request-1', { tenant } as never),
    ).resolves.toBe(publication);
    expect(publish).toHaveBeenCalledWith(tenant, menuId, 'publication-request-1');
  });

  it('rejects a missing or oversized idempotency key before touching the service', () => {
    const publish = jest.fn();
    const controller = new PublicationController({ publish } as unknown as PublicationService);

    expect(() => controller.publish(menuId, undefined, { tenant } as never)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_INVALID' }),
      }),
    );
    expect(() => controller.publish(menuId, 'x'.repeat(129), { tenant } as never)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_INVALID' }),
      }),
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('delegates active publication and history queries with the explicit menu', async () => {
    const active: ActiveMenuPublicationResponse = {
      menuId,
      publication,
      hasUnpublishedChanges: false,
    };
    const history: MenuPublicationHistoryResponse = {
      menuId,
      publications: [publication],
    };
    const getActive = jest.fn().mockResolvedValue(active);
    const listHistory = jest.fn().mockResolvedValue(history);
    const controller = new PublicationController({
      getActive,
      listHistory,
    } as unknown as PublicationService);

    await expect(controller.getActive(menuId, { tenant } as never)).resolves.toBe(active);
    await expect(controller.listHistory(menuId, { tenant } as never)).resolves.toBe(history);
    expect(getActive).toHaveBeenCalledWith(tenant, menuId);
    expect(listHistory).toHaveBeenCalledWith(tenant, menuId);
  });
});
