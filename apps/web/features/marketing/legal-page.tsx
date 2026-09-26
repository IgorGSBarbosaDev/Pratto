import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex h-[72px] max-w-[960px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Voltar para o Pratto">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
              P
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">PRATTO</span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-ink-soft transition hover:text-ink"
          >
            Entrar
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-[960px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-deep">
          Documento público
        </p>
        <h1 className="mt-5 max-w-3xl font-serif text-6xl leading-[0.92] tracking-[-0.025em]">
          {title}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft">{description}</p>
        <div className="mt-12 max-w-2xl rounded-2xl border border-line bg-sand p-6 sm:p-8">
          <h2 className="font-serif text-3xl leading-none">Conteúdo em preparação</h2>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            Este documento ainda não foi publicado. O conteúdo será revisado e disponibilizado antes
            de qualquer operação comercial do Pratto.
          </p>
          {children}
        </div>
        <Link
          href="/#produto"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-accent-deep"
        >
          Voltar ao projeto
        </Link>
      </section>
      <footer className="border-t border-line px-5 py-8 text-center text-xs text-ink-faint sm:px-8">
        © {new Date().getFullYear()} Pratto.
      </footer>
    </main>
  );
}
