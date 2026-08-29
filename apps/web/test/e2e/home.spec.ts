import { expect, test } from '@playwright/test';

test('loads the Pratto home page', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /transforme seu cardápio em uma experiência/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /ver planos/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /ver planos/i }).first()).toHaveAttribute(
    'href',
    '/plans',
  );
});

test('opens the dedicated SaaS plans page', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: /ver planos/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(
    page.getByRole('heading', { name: /planos para um menu que continua trabalhando/i }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^planos$/i })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /compare o que entra em cada plano/i }),
  ).toBeVisible();
});
