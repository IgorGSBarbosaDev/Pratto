import type { Metadata } from 'next';

import { LegalPage } from '../../features/marketing/legal-page';

export const metadata: Metadata = { title: 'Termos de uso' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de uso"
      description="As condições de uso do Pratto serão publicadas nesta página quando o produto estiver pronto para operação comercial."
    />
  );
}
