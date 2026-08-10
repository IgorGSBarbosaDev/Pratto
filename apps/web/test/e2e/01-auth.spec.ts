import { expect, test } from '@playwright/test';

test('login confirms the session, opens admin, and logout blocks it again', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('owner@pratto.local');
  await page.getByLabel('Senha').fill('test-admin-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 1 })).toBeVisible();
  await expect(page.getByText('Pratto Burger').first()).toBeVisible();
  const context = await page.request.get('http://localhost:4000/auth/me');
  expect(context.ok()).toBe(true);
  expect(await context.json()).toMatchObject({
    user: { email: 'owner@pratto.local' },
    activeOrganization: { name: 'Pratto Burger' },
  });

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login(?:\?next=%2Fadmin)?$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});
