import Link from 'next/link';

export default function PlansPage() {
  return (
    <main className="flex min-h-screen flex-col bg-sand text-ink">
      <header className="border-b border-line/80 bg-cream">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="Pratto, voltar ao projeto">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
              P
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">PRATTO</span>
          </Link>
        </div>
      </header>

      <section
        className="flex flex-1 items-center px-5 py-20 sm:px-8 lg:px-10"
        aria-labelledby="plans-page-title"
      >
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-line bg-cream p-7 sm:p-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Projeto de portfólio
          </p>
          <h1
            id="plans-page-title"
            className="mt-5 max-w-2xl font-serif text-4xl leading-[1.02] tracking-[-0.03em] sm:text-6xl"
          >
            Planos comerciais ainda não definidos.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-soft sm:text-lg sm:leading-8">
            O Pratto está em desenvolvimento como projeto de portfólio. Esta página não apresenta
            pacotes, preços ou condições de contratação. Essas informações serão publicadas se o
            produto entrar em operação comercial.
          </p>
          <Link
            href="/"
            className="mt-9 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-accent-deep"
          >
            Voltar ao projeto
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-cream px-5 py-6 text-center text-xs text-ink-faint sm:px-8">
        Pratto · Projeto de portfólio
      </footer>
    </main>
  );
}
