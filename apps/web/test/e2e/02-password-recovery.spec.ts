import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

type MailpitList = {
  messages?: Array<{ ID?: string; id?: string }>;
  items?: Array<{ ID?: string; id?: string }>;
};

async function latestResetToken(request: APIRequestContext) {
  await expect
    .poll(async () => {
      const response = await request.get('http://localhost:8025/api/v1/messages?limit=50');
      const body = (await response.json()) as MailpitList;
      return (body.messages ?? body.items ?? []).length;
    })
    .toBeGreaterThan(0);

  const listResponse = await request.get('http://localhost:8025/api/v1/messages?limit=50');
  const list = (await listResponse.json()) as MailpitList;
  const message = (list.messages ?? list.items ?? [])[0];
  const id = message?.ID ?? message?.id;
  if (!id) throw new Error('Mailpit did not return a message ID');
  const detail = (await (
    await request.get(`http://localhost:8025/api/v1/message/${id}`)
  ).json()) as {
    Text?: string;
    text?: string;
    HTML?: string;
    html?: string;
  };
  const content = detail.Text ?? detail.text ?? detail.HTML ?? detail.html ?? '';
  const match = content.match(/#token=([^\s<"]+)/);
  if (!match?.[1]) throw new Error('Password reset token not found in Mailpit');
  return decodeURIComponent(match[1].replace(/&amp;.*$/, ''));
}

test('recovery consumes one token, changes the password, and rejects the old password', async ({
  page,
  request,
}) => {
  await request.delete('http://localhost:8025/api/v1/messages');
  await page.goto('/forgot-password');
  await page.getByLabel('E-mail').fill('owner@pratto.local');
  await page.getByRole('button', { name: 'Enviar instruções' }).click();
  await expect(page.getByText(/Se a conta existir/)).toBeVisible();

  const token = await latestResetToken(request);
  await page.goto(`/reset-password#token=${encodeURIComponent(token)}`);
  const newPassword = 'new-e2e-admin-password';
  await page.getByLabel('Nova senha').fill(newPassword);
  await page.getByRole('button', { name: 'Alterar senha' }).click();
  await expect(page.getByText(/Senha alterada/)).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('owner@pratto.local');
  await page.getByLabel('Senha').fill('test-admin-password');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible();

  await page.getByLabel('Senha').fill(newPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
