import type { Metadata } from 'next';

import { LegalPage } from '../../features/marketing/legal-page';

export const metadata: Metadata = { title: 'Privacidade' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacidade"
      description="A política de privacidade do Pratto será publicada nesta página antes do início da operação comercial."
    />
  );
}
