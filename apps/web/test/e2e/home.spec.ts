import { expect, test } from '@playwright/test';

test('loads the Pratto home page', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /transforme seu cardápio em uma experiência/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /ver planos/i }).first()).toBeVisible();
});
