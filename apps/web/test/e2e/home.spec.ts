import { expect, test } from '@playwright/test';

test('loads the Pratto home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /seu cardápio em movimento/i })).toBeVisible();
});
