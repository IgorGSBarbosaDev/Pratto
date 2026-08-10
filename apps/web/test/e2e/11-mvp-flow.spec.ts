import { expect, test } from '@playwright/test';

const cafeMenuId = '50000000-0000-4000-8000-000000000002';

test.setTimeout(120_000);

test('completes the real MVP flow from setup to dashboard', async ({ page }) => {
  const suffix = Date.now().toString();
  const categoryName = `E2E ${suffix}`;
  const productName = `Produto E2E ${suffix}`;
  const analyticsRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/public/analytics/events')) analyticsRequests.push(request.url());
  });

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('owner@cafe-aurora.local');
  await page.getByLabel('Senha').fill('test-admin-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 1 })).toBeVisible();
  await expect(page.getByText('Café Aurora').first()).toBeVisible();

  await page.getByRole('button', { name: 'Informações', exact: true }).click();
  await page.getByLabel('Descrição').fill(`Fluxo completo validado em ${suffix}.`);
  await page.getByRole('button', { name: 'Salvar informações' }).click();
  await expect(page.getByText('Configurações salvas.')).toBeVisible();

  await page.getByRole('button', { name: 'Categorias', exact: true }).click();
  await page.getByLabel('Menu editável').selectOption(cafeMenuId);
  await page.getByRole('button', { name: 'Nova categoria' }).click();
  const categoryDialog = page.getByRole('dialog');
  await categoryDialog.getByLabel('Nome da categoria').fill(categoryName);
  await categoryDialog.getByLabel('Descrição').fill('Categoria criada no fluxo crítico E2E.');
  await categoryDialog.getByRole('button', { name: 'Salvar categoria' }).click();
  await expect(page.getByText(categoryName, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo prato' }).click();
  const productDialog = page.getByRole('dialog');
  await productDialog.getByLabel('Nome do prato').fill(productName);
  await productDialog.getByLabel('Descrição').fill('Produto criado no fluxo crítico E2E.');
  await productDialog.getByLabel('Preço (R$)').fill('29.90');
  await productDialog.getByLabel('Categoria').selectOption({ label: categoryName });
  await productDialog.getByRole('button', { name: 'Salvar prato' }).click();
  await expect(page.getByText(productName, { exact: true }).first()).toBeVisible();

  await page.getByLabel(`Gerenciar mídias de ${productName}`).click();
  const mediaDialog = page.getByRole('dialog');
  await mediaDialog.getByLabel('Arquivo de imagem ou vídeo').setInputFiles({
    name: 'produto-e2e.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await mediaDialog.getByRole('button', { name: 'Enviar mídia' }).click();
  await expect(mediaDialog.getByText('produto-e2e.png')).toBeVisible();
  await mediaDialog.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Publicação', exact: true }).click();
  await expect(page.getByText('Ainda não publicado')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar cardápio' }).click();
  await expect(page.getByText(/Cardápio publicado com sucesso na versão/)).toBeVisible();

  await expect(page.getByAltText('QR Code para o cardápio de Café Aurora')).toBeVisible();
  const publicLink = page.getByRole('link', { name: /http:\/\/localhost:3100\/menu\// });
  await expect(publicLink).toHaveAttribute(
    'href',
    'http://localhost:3100/menu/cafe-aurora-local/cafe-aurora',
  );
  await expect(page.getByRole('link', { name: 'Baixar PNG' })).toHaveAttribute(
    'download',
    'cafe-aurora-cardapio-qr.png',
  );
  await expect(page.getByRole('link', { name: 'Baixar SVG' })).toHaveAttribute(
    'download',
    'cafe-aurora-cardapio-qr.svg',
  );

  await page.goto('/menu/cafe-aurora-local/slug-antigo');
  await expect(page).toHaveURL(/\/menu\/cafe-aurora-local\/cafe-aurora$/);
  await page.getByRole('button', { name: 'Explorar o menu' }).click();
  await expect(page.getByRole('feed', { name: 'Produtos publicados' })).toBeVisible();
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();
  await page.getByRole('button', { name: `Compartilhar ${productName}` }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Compartilhar prato' });
  await expect(shareDialog).toBeVisible();
  const twitterShareUrl = await shareDialog
    .getByRole('link', { name: 'Twitter / X' })
    .getAttribute('href');
  const directProductUrl = new URL(twitterShareUrl!).searchParams.get('url');
  expect(directProductUrl).toMatch(
    /^http:\/\/localhost:3100\/menu\/cafe-aurora-local\/cafe-aurora\?product=[0-9a-f-]{36}$/,
  );
  await shareDialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(shareDialog).not.toBeVisible();

  await page.goto(directProductUrl!);
  await expect(page.getByRole('feed', { name: 'Produtos publicados' })).toBeVisible();
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();
  await page.getByRole('button', { name: categoryName, exact: true }).click();
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();
  await page.getByRole('heading', { name: productName }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(() => analyticsRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await expect(page.getByText('Acessos ao cardápio')).toBeVisible();
});
