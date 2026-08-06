import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { AppProviders } from '../features/auth/auth-provider';

export const metadata: Metadata = {
  title: 'Pratto',
  description: 'Cardápio digital visual e mobile-first.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
