import { expect, test } from '@playwright/test';

test('loads the Pratto home page', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /transforme seu cardápio em uma experiência/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sobre o projeto' }).first()).toBeVisible();
});

test('does not advertise undefined commercial plans', async ({ page }) => {
  await page.goto('/plans');
  await expect(
    page.getByRole('heading', { name: /planos comerciais ainda não definidos/i }),
  ).toBeVisible();
  await expect(page.getByText(/projeto de portfólio/i).first()).toBeVisible();
  await expect(page.getByText(/preço em breve|essencial|presença|inteligência/i)).toHaveCount(0);
});
