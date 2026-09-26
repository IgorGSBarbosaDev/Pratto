import type { Metadata } from 'next';

import { LegalPage } from '../../features/marketing/legal-page';

export const metadata: Metadata = { title: 'Privacidade' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacidade"
      description="O Pratto está em desenvolvimento como projeto de portfólio. A política definitiva ainda está em preparação e será publicada antes de qualquer operação comercial."
    />
  );
}
