import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest, TenantPrincipal } from '../../identity/domain/auth.types';

import { ProductMediaController } from './product-media.controller';

const menuId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const mediaId = '33333333-3333-4333-8333-333333333333';
const request = {
  tenant: { organizationId: 'organization-id', role: 'OWNER' } as TenantPrincipal,
} as unknown as AuthenticatedRequest;

describe('ProductMediaController', () => {
  const service = {
    listMedia: jest.fn(),
    uploadMedia: jest.fn(),
    setPrimary: jest.fn(),
    reorderMedia: jest.fn(),
    removeMedia: jest.fn(),
  };
  let controller: ProductMediaController;
  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductMediaController(service as never);
  });

  it('delegates all validated media operations with a file boundary intact', async () => {
    service.listMedia.mockResolvedValue({});
    service.uploadMedia.mockResolvedValue({});
    service.setPrimary.mockResolvedValue({});
    service.reorderMedia.mockResolvedValue({});
    service.removeMedia.mockResolvedValue({});
    const file = {
      buffer: new Uint8Array([1]),
      mimetype: 'image/png',
      originalname: 'x.png',
      size: 1,
    };
    await controller.listMedia(menuId, productId, request);
    await controller.uploadMedia(menuId, productId, file, request);
    await controller.setPrimary(menuId, productId, mediaId, request);
    await controller.reorderMedia(menuId, productId, { mediaIds: [mediaId] }, request);
    await controller.removeMedia(menuId, productId, mediaId, request);
    expect(service.uploadMedia).toHaveBeenCalledWith(request.tenant, menuId, productId, file);
    expect(service.reorderMedia).toHaveBeenCalledWith(request.tenant, menuId, productId, {
      mediaIds: [mediaId],
    });
    expect(service.setPrimary).toHaveBeenCalledWith(request.tenant, menuId, productId, mediaId);
  });

  it('rejects invalid IDs and incomplete reorder payloads before the service', () => {
    expect(() => controller.listMedia('bad', productId, request)).toThrow(StableHttpException);
    expect(() =>
      controller.reorderMedia(menuId, productId, { mediaIds: ['bad'] }, request),
    ).toThrow(StableHttpException);
    expect(service.listMedia).not.toHaveBeenCalled();
    expect(service.reorderMedia).not.toHaveBeenCalled();
  });
});
