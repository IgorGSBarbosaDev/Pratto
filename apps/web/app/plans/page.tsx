import { ArrowLeft, ArrowRight, Check, Minus } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Essencial',
    description: 'A base para colocar um cardápio vivo no ar.',
    icon: '01',
    featured: false,
    features: [
      'Catálogo de categorias e produtos',
      'URL pública do cardápio',
      'Atualizações no rascunho',
    ],
  },
  {
    name: 'Presença',
    description: 'Mais espaço para o seu restaurante aparecer bem.',
    icon: '02',
    featured: true,
    features: [
      'Tudo do Essencial',
      'Fotos e vídeos dos pratos',
      'Publicação versionada',
      'QR Code e compartilhamento',
    ],
  },
  {
    name: 'Inteligência',
    description: 'Contexto para entender como o menu é explorado.',
    icon: '03',
    featured: false,
    features: [
      'Tudo do Presença',
      'Analytics anônimo',
      'Dashboard de navegação',
      'Métricas por categoria e prato',
    ],
  },
] as const;

const comparisonRows = [
  { feature: 'Catálogo de categorias e produtos', plans: [true, true, true] },
  { feature: 'URL pública do cardápio', plans: [true, true, true] },
  { feature: 'Atualizações no rascunho', plans: [true, true, true] },
  { feature: 'Fotos e vídeos dos pratos', plans: [false, true, true] },
  { feature: 'Publicação versionada', plans: [false, true, true] },
  { feature: 'QR Code e compartilhamento', plans: [false, true, true] },
  { feature: 'Analytics anônimo', plans: [false, false, true] },
  { feature: 'Dashboard de navegação', plans: [false, false, true] },
  { feature: 'Métricas por categoria e prato', plans: [false, false, true] },
] as const;

export default function PlansPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-sand text-ink">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="Pratto, voltar ao início">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
              P
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">PRATTO</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className="hidden items-center gap-2 text-sm font-medium text-ink-soft transition hover:text-ink sm:inline-flex"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Voltar à home
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-cream transition hover:bg-accent-deep"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <section id="planos" className="bg-sand" aria-labelledby="plans-page-title">
        <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-6 sm:px-8 sm:pb-28 sm:pt-10 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1
              id="plans-page-title"
              className="font-serif text-5xl leading-[0.94] tracking-[-0.03em] sm:text-6xl"
            >
              Planos
            </h1>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-6 sm:p-8 ${plan.featured ? 'border-ink bg-ink text-cream shadow-[0_20px_50px_-30px_rgba(24,23,22,.7)]' : 'border-line bg-cream'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl font-semibold ${plan.featured ? 'bg-cream/10 text-accent' : 'bg-sand text-accent-deep'}`}
                  >
                    {plan.icon}
                  </span>
                  {plan.featured ? (
                    <span className="rounded-full border border-accent/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                      Mais completo
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-8 font-serif text-4xl leading-none">{plan.name}</h2>
                <p
                  className={`mt-4 min-h-14 text-sm leading-6 ${plan.featured ? 'text-cream/65' : 'text-ink-soft'}`}
                >
                  {plan.description}
                </p>
                <div
                  className={`mt-8 border-y py-5 ${plan.featured ? 'border-cream/15' : 'border-line'}`}
                >
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${plan.featured ? 'text-cream/45' : 'text-ink-faint'}`}
                  >
                    Investimento
                  </span>
                  <p className="mt-2 font-serif text-3xl">Preço em breve</p>
                </div>
                <ul
                  className="mt-7 flex flex-1 flex-col gap-4"
                  aria-label={`Recursos do plano ${plan.name}`}
                >
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex items-start gap-3 text-sm leading-6 ${plan.featured ? 'text-cream/75' : 'text-ink-soft'}`}
                    >
                      <Check
                        size={17}
                        className={`mt-0.5 shrink-0 ${plan.featured ? 'text-accent' : 'text-herb'}`}
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/#contato"
                  className={`mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition active:scale-[0.98] ${plan.featured ? 'bg-cream text-ink hover:bg-white' : 'border border-ink text-ink hover:bg-sand'}`}
                >
                  Quero acompanhar <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="comparativo" className="bg-cream" aria-labelledby="comparison-title">
        <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="max-w-2xl">
            <h2
              id="comparison-title"
              className="font-serif text-5xl leading-[0.94] tracking-[-0.03em] sm:text-6xl"
            >
              Compare o que entra em cada plano.
            </h2>
          </div>

          <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-cream">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <caption className="sr-only">
                Comparação dos recursos dos planos SaaS do Pratto
              </caption>
              <thead>
                <tr className="border-b border-line bg-sand/55">
                  <th
                    scope="col"
                    className="w-[46%] px-5 py-5 text-sm font-semibold text-ink sm:px-7"
                  >
                    Recursos
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.name} scope="col" className="px-4 py-5 sm:px-6">
                      <span className="block font-serif text-2xl font-normal text-ink">
                        {plan.name}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                        Preço em breve
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-5 py-5 text-sm font-medium text-ink-soft sm:px-7">
                      {row.feature}
                    </th>
                    {row.plans.map((included, index) => (
                      <td
                        key={`${row.feature}-${plans[index]?.name}`}
                        className="px-4 py-5 sm:px-6"
                      >
                        <ComparisonMark
                          included={included}
                          planName={plans[index]?.name ?? 'plano'}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="border-t border-cream/10 bg-ink px-5 py-8 text-cream sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 text-sm text-cream/55 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3 text-cream">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream font-serif text-xl text-ink">
              P
            </span>
            <span className="font-semibold tracking-[0.18em]">PRATTO</span>
          </Link>
          <span>Planos SaaS em construção.</span>
        </div>
      </footer>
    </main>
  );
}

function ComparisonMark({ included, planName }: { included: boolean; planName: string }) {
  return included ? (
    <span className="flex items-center gap-2 text-sm font-medium text-herb">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-herb/10">
        <Check size={16} aria-hidden="true" />
      </span>
      <span className="sr-only">Incluído no plano {planName}</span>
    </span>
  ) : (
    <span className="flex items-center gap-2 text-ink-faint">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sand">
        <Minus size={16} aria-hidden="true" />
      </span>
      <span className="sr-only">Não incluído no plano {planName}</span>
    </span>
  );
}
