import type { Metadata } from 'next';

import { LegalPage } from '../../features/marketing/legal-page';

export const metadata: Metadata = { title: 'Termos de uso' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de uso"
      description="O Pratto está em desenvolvimento como projeto de portfólio. Os termos definitivos serão publicados antes de qualquer operação comercial."
    />
  );
}
