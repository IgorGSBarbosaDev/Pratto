import { expect, test } from '@playwright/test';

test('shows the real unpublished menu state without administrative requests', async ({ page }) => {
  const administrativeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/admin/')) administrativeRequests.push(request.url());
  });

  const response = await page.goto('/menu/pratto-burger-local/pratto-burger');

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Cardápio ainda não publicado' })).toBeVisible();
  expect(administrativeRequests).toEqual([]);
});

test('returns a real 404 for an unknown public establishment', async ({ page }) => {
  const response = await page.goto('/menu/estabelecimento-inexistente/menu');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Cardápio não encontrado' })).toBeVisible();
});
