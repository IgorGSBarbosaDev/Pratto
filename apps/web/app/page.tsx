import { ArrowRight, BarChart3, Smartphone, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-sand px-6 py-8 text-ink sm:px-10 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-line pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
              P
            </span>
            <span className="text-sm font-semibold tracking-[0.1em]">PRATTO</span>
          </div>
          <Link
            className="text-sm font-medium text-ink-soft transition hover:text-ink"
            href="/login"
          >
            Área administrativa
          </Link>
        </header>
        <section className="grid items-center gap-12 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div>
            <h1 className="max-w-[12ch] font-serif text-5xl leading-[0.98] sm:text-7xl">
              Seu cardápio em movimento.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
              Uma experiência visual para descobrir pratos, conhecer o restaurante e navegar por
              cada detalhe — sem distrações de compra.
            </p>
            <Link
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-accent-deep px-6 font-medium text-white shadow-[0_14px_30px_-16px_var(--color-accent)] transition hover:bg-ink active:scale-[0.98]"
              href="/login"
            >
              Administrar meu cardápio <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="relative mx-auto w-full max-w-md rounded-[36px] bg-ink p-3 shadow-[0_40px_80px_-30px_rgba(24,23,22,0.45)]">
            <div className="relative aspect-[390/650] overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_50%_10%,#6d4a32_0%,#181716_64%)] p-6 text-white">
              <div className="flex gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-accent-deep">
                  Populares
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs">Entradas</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs">Principais</span>
              </div>
              <div className="absolute inset-x-6 bottom-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                  Descoberta visual
                </p>
                <p className="mt-2 font-serif text-4xl leading-none">Cada prato ocupa a cena.</p>
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/20 pt-5 text-center text-[11px] text-white/70">
                  <span className="flex flex-col items-center gap-1">
                    <UtensilsCrossed size={19} /> Menu
                  </span>
                  <span className="flex flex-col items-center gap-1">
                    <Smartphone size={19} /> Categorias
                  </span>
                  <span className="flex flex-col items-center gap-1">
                    <BarChart3 size={19} /> Restaurante
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <footer className="border-t border-line py-6 text-sm text-ink-faint">
          Cardápios digitais por PRATTO
        </footer>
      </div>
    </main>
  );
}
