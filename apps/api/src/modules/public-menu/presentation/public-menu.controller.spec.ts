import type { PublicMenuPageResponse } from '@pratto/contracts';

import { PublicMenuServiceError } from '../application/public-menu.service';
import type { PublicMenuService } from '../application/public-menu.service';

import { PublicMenuController } from './public-menu.controller';

const result: PublicMenuPageResponse = {
  establishment: {
    publicId: 'establishment-public-id',
    name: 'Casa Aurora',
    slug: 'casa-aurora',
    description: null,
    phone: null,
    whatsapp: null,
    address: null,
    operatingHours: {} as PublicMenuPageResponse['establishment']['operatingHours'],
    logo: null,
    coverImage: null,
    theme: { mode: 'LIGHT', primaryColor: '#166534' },
  },
  menu: { name: 'Menu principal', version: 1, publishedAt: '2026-08-09T12:00:00.000Z' },
  categories: [],
  products: [],
  nextCursor: null,
};

describe('PublicMenuController', () => {
  it('accepts public queries without a session and delegates the stable public id', async () => {
    const getPage = jest.fn().mockResolvedValue(result);
    const controller = new PublicMenuController({ getPage } as unknown as PublicMenuService);

    await expect(
      controller.getPage('establishment-public-id', { limit: '6', categoryId: undefined }),
    ).resolves.toBe(result);
    expect(getPage).toHaveBeenCalledWith('establishment-public-id', {
      limit: 6,
      categoryId: undefined,
    });
  });

  it('rejects invalid public query values before calling the service', () => {
    const getPage = jest.fn();
    const controller = new PublicMenuController({ getPage } as unknown as PublicMenuService);

    expect(() => controller.getPage('public-id', { limit: '13' })).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(getPage).not.toHaveBeenCalled();
  });

  it('maps the no-publication error to a stable not-found response', async () => {
    const getPage = jest
      .fn()
      .mockRejectedValue(
        new PublicMenuServiceError('PUBLIC_MENU_NOT_PUBLISHED', 'Ainda não publicado.'),
      );
    const controller = new PublicMenuController({ getPage } as unknown as PublicMenuService);

    await expect(controller.getPage('public-id', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLIC_MENU_NOT_PUBLISHED' }),
      status: 404,
    });
  });
});
