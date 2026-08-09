import { expect, test } from '@playwright/test';

test('opens the public menu without login or administrative requests', async ({ page }) => {
  const administrativeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/admin/')) administrativeRequests.push(request.url());
  });
  await page.route('**/public/establishments/establishment-public-id/menu*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        establishment: {
          publicId: 'establishment-public-id',
          name: 'Casa Aurora',
          slug: 'casa-aurora',
          description: 'Comida feita na hora',
          phone: null,
          whatsapp: null,
          address: null,
          operatingHours: {},
          logo: null,
          coverImage: null,
          theme: { mode: 'DARK', primaryColor: '#166534' },
        },
        menu: { name: 'Menu principal', version: 1, publishedAt: '2026-08-09T12:00:00.000Z' },
        categories: [],
        products: [
          {
            id: 'product-1',
            categoryId: 'category-1',
            name: 'Prato público',
            description: 'Disponível no cardápio publicado.',
            price: '25.00',
            promotionalPrice: null,
            ingredients: null,
            allergens: null,
            availability: 'AVAILABLE',
            featured: false,
            media: [],
          },
        ],
        nextCursor: null,
      }),
    });
  });

  await page.goto('/menu/establishment-public-id/casa-aurora');
  await expect(page.getByRole('heading', { name: 'Prato público' })).toBeVisible();
  expect(administrativeRequests).toEqual([]);
});
