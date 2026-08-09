import { HttpStatus } from '@nestjs/common';
import type { EstablishmentSettingsResponse } from '@pratto/contracts';

import type { EstablishmentService } from '../application/establishment.service';

import { EstablishmentController } from './establishment.controller';

const tenant = {
  organizationId: 'organization-a',
  establishmentIds: ['11111111-1111-4111-8111-111111111111'],
} as never;

const settings = {
  id: '11111111-1111-4111-8111-111111111111',
  publicId: 'public-a',
  name: 'Casa A',
} as EstablishmentSettingsResponse;

describe('EstablishmentController', () => {
  it('passes the resolved tenant to the read endpoint', async () => {
    const getSettings = jest.fn().mockResolvedValue(settings);
    const controller = new EstablishmentController({
      getSettings,
    } as unknown as EstablishmentService);

    await expect(
      controller.getSettings('11111111-1111-4111-8111-111111111111', { tenant } as never),
    ).resolves.toBe(settings);
    expect(getSettings).toHaveBeenCalledWith(tenant, '11111111-1111-4111-8111-111111111111');
  });

  it('rejects malformed path identifiers and unknown body fields', async () => {
    const service = { updateSettings: jest.fn() } as unknown as EstablishmentService;
    const controller = new EstablishmentController(service);

    expect(() => controller.updateSettings('not-an-uuid', {}, { tenant } as never)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ statusCode: HttpStatus.BAD_REQUEST }),
      }),
    );
    expect(() =>
      controller.updateSettings('11111111-1111-4111-8111-111111111111', { unexpected: true }, {
        tenant,
      } as never),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it('passes valid updates to the application service', async () => {
    const updateSettings = jest.fn().mockResolvedValue(settings);
    const controller = new EstablishmentController({
      updateSettings,
    } as unknown as EstablishmentService);
    const establishmentId = '11111111-1111-4111-8111-111111111111';

    await expect(
      controller.updateSettings(establishmentId, { name: 'Casa A nova' }, { tenant } as never),
    ).resolves.toBe(settings);
    expect(updateSettings).toHaveBeenCalledWith(tenant, establishmentId, { name: 'Casa A nova' });
  });
});
