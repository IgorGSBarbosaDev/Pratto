import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { AppProviders } from '../features/auth/auth-provider';

function metadataBase(): URL {
  try {
    return new URL(
      process.env.PUBLIC_MENU_BASE_URL || process.env.WEB_URL || 'http://localhost:3000',
    );
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: 'Pratto', template: '%s | Pratto' },
  description: 'Cardápio digital visual e mobile-first.',
  applicationName: 'Pratto',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Pratto',
    title: 'Pratto',
    description: 'Cardápio digital visual e mobile-first.',
  },
  twitter: {
    card: 'summary',
    title: 'Pratto',
    description: 'Cardápio digital visual e mobile-first.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <script
          type="application/pratto-design-contract"
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: PRATTO transforma descoberta de pratos em uma publicação editorial imersiva e recusa o cardápio genérico ou o dashboard SaaS frio.
OWN-WORLD: creme, areia, tinta, páprica e erva; Instrument Serif nos títulos; Instrument Sans na operação; fotografia dominante, linhas finas e profundidade apenas em superfícies transitórias.
STORY: o cliente entra, descobre, filtra e entende o restaurante; o operador escolhe o contexto, edita, publica e mede sem perder contratos reais.
FIRST VIEWPORT: Customer abre com capa editorial e CTA; Admin abre com sidebar fixa, título serifado, métricas e analytics reais.
FORM: referência PRATTO Fase 1 aprovada; seed key pratto-phase-1-reference.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
