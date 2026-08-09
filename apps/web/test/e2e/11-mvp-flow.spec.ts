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
  await expect(page.getByRole('heading', { name: 'Café Aurora', level: 1 })).toBeVisible();

  const description = page.getByLabel('Descrição').first();
  await description.fill(`Fluxo completo validado em ${suffix}.`);
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('Configurações salvas.')).toBeVisible();

  await page.getByLabel('Menu alvo').selectOption(cafeMenuId);
  const categoryForm = page.locator('form').filter({ hasText: 'Nova categoria' });
  await categoryForm.getByLabel('Nome').fill(categoryName);
  await categoryForm.getByRole('button', { name: 'Adicionar categoria' }).click();
  await expect(page.getByRole('heading', { name: categoryName, level: 4 })).toBeVisible();

  await page.getByLabel('Menu alvo dos produtos').selectOption(cafeMenuId);
  const productForm = page.locator('form').filter({ hasText: 'Novo produto' });
  await productForm.getByLabel('Categoria').selectOption({ label: categoryName });
  await productForm.getByLabel('Nome').fill(productName);
  await productForm.getByLabel('Preço').fill('29.90');
  await productForm.getByRole('button', { name: 'Adicionar produto' }).click();
  await expect(page.getByRole('heading', { name: productName, level: 4 })).toBeVisible();

  let productRow = page.locator('article').filter({ hasText: productName }).last();
  await productRow.getByRole('button', { name: 'Mídias' }).click();
  const imageInput = productRow.getByLabel('Arquivo de imagem ou vídeo');
  await imageInput.setInputFiles({
    name: 'produto-e2e.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await productRow.getByRole('button', { name: 'Enviar mídia' }).click();
  await expect(productRow.getByText('produto-e2e.png')).toBeVisible();

  productRow = page.locator('article').filter({ hasText: productName }).last();
  await productRow.getByLabel('Arquivo de imagem ou vídeo').setInputFiles({
    name: 'produto-e2e.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]),
  });
  await productRow.getByRole('button', { name: 'Enviar mídia' }).click();
  await expect(productRow.getByText('produto-e2e.mp4')).toBeVisible();

  await page.getByLabel('Menu para publicar').selectOption(cafeMenuId);
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
  await page.goto('/menu/cafe-aurora-local/cafe-aurora');
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();
  await expect(page.getByRole('feed', { name: 'Produtos publicados' })).toBeVisible();
  await page.getByRole('button', { name: categoryName }).click();
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();
  await page
    .getByRole('article', { name: productName })
    .getByRole('button', { name: 'Ver detalhes' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(() => analyticsRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Desempenho do cardápio' })).toBeVisible();
  await expect(page.getByText('Acessos ao cardápio')).toBeVisible();
  await expect(page.getByText('QR Code do cardápio')).toBeVisible();
});
