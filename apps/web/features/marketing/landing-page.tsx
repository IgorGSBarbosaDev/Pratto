'use client';

import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Grid2X2,
  Image as ImageIcon,
  LayoutDashboard,
  LineChart,
  Menu as MenuIcon,
  MessageCircle,
  MousePointerClick,
  Palette,
  Phone,
  QrCode,
  Search,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

const dishImages = {
  main: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85',
  pizza:
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=85',
  salad:
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=85',
  dessert:
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=85',
};

const showcaseTabs = [
  { id: 'discovery', label: 'Descoberta', icon: Sparkles },
  { id: 'categories', label: 'Categorias', icon: Grid2X2 },
  { id: 'search', label: 'Busca', icon: Search },
  { id: 'featured', label: 'Destaques', icon: Zap },
  { id: 'sharing', label: 'Compartilhamento', icon: Share2 },
] as const;

type ShowcaseTab = (typeof showcaseTabs)[number]['id'];

const showcaseCopy: Record<ShowcaseTab, { title: string; description: string }> = {
  discovery: {
    title: 'Cada prato ocupa a cena.',
    description:
      'Uma navegação vertical feita para despertar curiosidade e dar contexto a cada escolha.',
  },
  categories: {
    title: 'Encontre o que dá vontade.',
    description:
      'Categorias visuais ajudam o cliente a explorar o cardápio no ritmo que faz sentido para ele.',
  },
  search: {
    title: 'A descoberta também pode ser direta.',
    description:
      'Busca por prato, descrição e categoria para quem já chegou sabendo o que procura.',
  },
  featured: {
    title: 'Dê mais espaço ao que merece atenção.',
    description: 'Produtos em destaque ganham presença sem perder a estrutura do seu cardápio.',
  },
  sharing: {
    title: 'Do balcão para a mesa em um toque.',
    description: 'Compartilhe por link ou QR Code e deixe o cardápio pronto para qualquer celular.',
  },
};

const faqs = [
  {
    question: 'Preciso instalar algum aplicativo?',
    answer:
      'Não. O cliente acessa o cardápio por um link ou QR Code, direto no navegador do celular.',
  },
  {
    question: 'Como os clientes acessam o cardápio?',
    answer:
      'Você publica uma versão do cardápio e compartilha a URL pública ou o QR Code do seu estabelecimento.',
  },
  {
    question: 'Funciona em qualquer celular?',
    answer:
      'A experiência é mobile-first e foi pensada para funcionar em navegadores modernos, sem exigir instalação.',
  },
  {
    question: 'Posso alterar produtos e preços?',
    answer:
      'Sim. O catálogo é administrável. As alterações ficam no rascunho até você publicar uma nova versão para o público.',
  },
  {
    question: 'Como funciona o QR Code?',
    answer:
      'O QR Code aponta para o endereço público do seu menu. Assim, o cliente escaneia e começa a explorar.',
  },
  {
    question: 'O Pratto recebe pedidos?',
    answer:
      'Ainda não. O foco atual é apresentar o cardápio e facilitar a descoberta dos pratos, sem carrinho ou checkout.',
  },
  {
    question: 'Como funciona o suporte?',
    answer:
      'O canal comercial será configurado conforme a operação do produto. Enquanto isso, você pode abrir o contato abaixo para preparar uma mensagem.',
  },
  {
    question: 'Posso cancelar meu plano?',
    answer:
      'A tabela comercial e as condições de assinatura ainda não foram publicadas. Fale com a gente para acompanhar essa definição.',
  },
];

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseTab>('discovery');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactOpen, setContactOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <main className="overflow-x-hidden bg-cream text-ink" aria-labelledby="landing-title">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="#produto" className="flex items-center gap-3" aria-label="Pratto, início">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
              P
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">PRATTO</span>
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
            <LandingNavLink href="#produto">Produto</LandingNavLink>
            <LandingNavLink href="#como-funciona">Como funciona</LandingNavLink>
            <LandingNavLink href="#recursos">Recursos</LandingNavLink>
            <LandingNavLink href="/plans">Planos</LandingNavLink>
            <LandingNavLink href="#faq">FAQ</LandingNavLink>
          </nav>

          <div className="hidden items-center gap-5 sm:flex">
            <Link
              className="text-sm font-medium text-ink-soft transition hover:text-ink"
              href="/login"
            >
              Entrar
            </Link>
            <LandingButton href="/plans" size="small">
              Ver planos <ArrowUpRight size={16} aria-hidden="true" />
            </LandingButton>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink transition hover:bg-sand sm:hidden"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <MenuIcon size={20} aria-hidden="true" />
            )}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-line bg-cream px-5 py-5 sm:hidden">
            <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
              <MobileNavLink href="#produto" onClick={closeMobileMenu}>
                Produto
              </MobileNavLink>
              <MobileNavLink href="#como-funciona" onClick={closeMobileMenu}>
                Como funciona
              </MobileNavLink>
              <MobileNavLink href="#recursos" onClick={closeMobileMenu}>
                Recursos
              </MobileNavLink>
              <MobileNavLink href="/plans" onClick={closeMobileMenu}>
                Planos
              </MobileNavLink>
              <MobileNavLink href="#faq" onClick={closeMobileMenu}>
                FAQ
              </MobileNavLink>
            </nav>
            <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
              <Link
                className="text-sm font-medium text-ink-soft"
                href="/login"
                onClick={closeMobileMenu}
              >
                Entrar
              </Link>
              <LandingButton href="/plans" size="small" onClick={closeMobileMenu}>
                Ver planos <ArrowUpRight size={16} aria-hidden="true" />
              </LandingButton>
            </div>
          </div>
        ) : null}
      </header>

      <section id="produto" className="relative isolate overflow-hidden bg-cream">
        <div className="pointer-events-none absolute -right-40 top-0 -z-10 h-[560px] w-[560px] rounded-full bg-accent/10 blur-3xl" />
        <div className="mx-auto grid max-w-[1240px] items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:px-10 lg:pb-28 lg:pt-20">
          <div className="landing-reveal landing-reveal-visible max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-deep">
              <span className="h-px w-8 bg-accent-deep" aria-hidden="true" />
              Cardápio digital, com presença
            </p>
            <h1
              id="landing-title"
              className="max-w-[13ch] font-serif text-[clamp(3.2rem,6vw,5.4rem)] leading-[0.88] tracking-[-0.035em] text-ink"
            >
              Transforme seu cardápio em uma experiência que dá vontade de explorar.
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-8 text-ink-soft sm:text-lg">
              O Pratto apresenta seus pratos em uma experiência visual, mobile-first e fácil de
              atualizar — para o cliente descobrir mais do que uma lista de produtos.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LandingButton href="/plans">
                Ver planos <ArrowRight size={18} aria-hidden="true" />
              </LandingButton>
              <a
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink transition hover:bg-sand"
                href="#recursos"
              >
                Ver como funciona{' '}
                <ChevronRight
                  className="transition group-hover:translate-x-1"
                  size={18}
                  aria-hidden="true"
                />
              </a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-5 gap-y-3 border-t border-line pt-5 text-xs font-medium text-ink-faint">
              <span className="inline-flex items-center gap-2">
                <Check size={15} className="text-herb" aria-hidden="true" /> Feed visual
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={15} className="text-herb" aria-hidden="true" /> Publicação versionada
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={15} className="text-herb" aria-hidden="true" /> Analytics anônimo
              </span>
            </div>
          </div>

          <div className="landing-reveal landing-reveal-visible relative mx-auto w-full max-w-[600px] lg:mr-0">
            <HeroMenuPreview />
            <div className="landing-float absolute -left-2 bottom-12 hidden items-center gap-3 rounded-2xl border border-line bg-cream p-3 shadow-[0_18px_42px_-24px_rgba(24,23,22,.5)] sm:flex lg:-left-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand text-accent-deep">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-sm">Mais do que um PDF</strong>
                <span className="text-xs text-ink-faint">Descoberta em primeiro lugar</span>
              </span>
            </div>
            <div className="landing-float landing-float-late absolute -right-2 top-20 hidden items-center gap-3 rounded-2xl border border-line bg-cream p-3 shadow-[0_18px_42px_-24px_rgba(24,23,22,.5)] sm:flex lg:-right-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-cream">
                <QrCode size={18} aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-sm">Pronto para compartilhar</strong>
                <span className="text-xs text-ink-faint">Link ou QR Code</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-sand" aria-labelledby="problem-title">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-10 lg:py-28">
          <Reveal>
            <h2
              id="problem-title"
              className="max-w-[9ch] font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
            >
              Cardápios digitais não precisam parecer PDFs.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-ink-soft">
              Quando a navegação é longa, estática e sem contexto, os melhores pratos podem passar
              despercebidos.
            </p>
          </Reveal>
          <Reveal className="grid gap-3 sm:grid-cols-2">
            <ProblemTile
              icon={<ListIcon />}
              title="Listas que cansam"
              description="Muitos itens, pouca hierarquia e nenhuma pista de por onde começar."
            />
            <ProblemTile
              icon={<ImageIcon size={20} aria-hidden="true" />}
              title="Produtos sem presença"
              description="Pratos importantes dividem o mesmo espaço visual que todo o resto."
            />
            <ProblemTile
              icon={<Search size={20} aria-hidden="true" />}
              title="Descoberta difícil"
              description="Encontrar uma categoria ou um prato vira uma busca lenta no celular."
            />
            <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-cream sm:col-span-2 sm:flex sm:items-end sm:justify-between sm:gap-8">
              <div className="relative z-10 max-w-lg">
                <span className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  A mudança
                </span>
                <h3 className="font-serif text-4xl leading-none">
                  O Pratto coloca a experiência no centro.
                </h3>
                <p className="mt-4 max-w-md text-sm leading-6 text-cream/70">
                  Visual, contexto e navegação trabalham juntos para o cliente explorar com mais
                  clareza.
                </p>
              </div>
              <div
                className="relative mt-8 h-24 w-full max-w-[220px] overflow-hidden rounded-xl border border-cream/15 bg-cream/5 sm:mt-0"
                aria-hidden="true"
              >
                <div className="absolute inset-x-5 bottom-4 h-12 rounded-t-[60px] border border-accent/60 bg-accent/15" />
                <div className="absolute bottom-4 left-8 h-8 w-8 rounded-full bg-sand-deep/60" />
                <div className="absolute bottom-3 right-9 h-16 w-16 rounded-full border-8 border-herb/60" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="recursos" className="bg-cream" aria-labelledby="showcase-title">
        <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <Reveal className="max-w-2xl">
            <h2
              id="showcase-title"
              className="font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
            >
              Veja o cardápio pelo olhar do cliente.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink-soft">
              Uma prévia da experiência que transforma conteúdo do catálogo em uma jornada visual.
              Clique para explorar cada momento.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <Reveal className="order-2 lg:order-1">
              <ShowcaseMenuPreview activeTab={activeShowcase} />
            </Reveal>
            <div className="order-1 lg:order-2">
              <div
                className="flex gap-2 overflow-x-auto pb-2 no-scrollbar"
                role="tablist"
                aria-label="Recursos do produto"
              >
                {showcaseTabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = activeShowcase === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="product-preview"
                      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${selected ? 'border-ink bg-ink text-cream' : 'border-line bg-cream text-ink-soft hover:border-ink/30 hover:bg-sand'}`}
                      onClick={() => setActiveShowcase(tab.id)}
                    >
                      <Icon size={16} aria-hidden="true" /> {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 border-t border-line pt-8" aria-live="polite">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-deep">
                  Pratto em uso
                </p>
                <h3 className="mt-3 max-w-md font-serif text-4xl leading-none sm:text-5xl">
                  {showcaseCopy[activeShowcase].title}
                </h3>
                <p className="mt-5 max-w-md text-base leading-7 text-ink-soft">
                  {showcaseCopy[activeShowcase].description}
                </p>
                <a
                  href="#como-funciona"
                  className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-ink"
                >
                  Entenda o fluxo{' '}
                  <ArrowRight
                    size={17}
                    className="transition group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-sand" aria-labelledby="benefits-title">
        <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <Reveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h2
                id="benefits-title"
                className="max-w-[10ch] font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
              >
                Seu cardápio trabalhando a favor do restaurante.
              </h2>
            </div>
            <p className="max-w-sm text-base leading-7 text-ink-soft">
              Apresentação, descoberta e leitura do comportamento em um só lugar.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <BenefitCard
                className="min-h-[340px] bg-ink text-cream"
                icon={<ImageIcon size={20} aria-hidden="true" />}
                title="Valorize seus produtos"
                description="Use imagens, destaques e contexto para que cada prato tenha espaço para convencer."
                dark
              >
                <div
                  className="absolute -bottom-12 -right-8 h-56 w-56 overflow-hidden rounded-full border-[14px] border-cream/10 sm:-right-12"
                  aria-hidden="true"
                >
                  <Image
                    src={dishImages.main}
                    alt=""
                    fill
                    sizes="224px"
                    className="object-cover opacity-80"
                  />
                </div>
              </BenefitCard>
            </Reveal>
            <Reveal className="lg:col-span-5">
              <BenefitCard
                className="min-h-[340px] bg-cream"
                icon={<Search size={20} aria-hidden="true" />}
                title="Facilite a descoberta"
                description="Categorias, busca e uma navegação feita para o celular ajudam o cliente a encontrar o que quer."
              />
            </Reveal>
            <Reveal className="lg:col-span-5">
              <BenefitCard
                className="min-h-[300px] bg-accent text-white"
                icon={<LineChart size={20} aria-hidden="true" />}
                title="Entenda seus clientes"
                description="Acompanhe acessos, visualizações, interações e os produtos mais explorados."
                dark
              >
                <div
                  className="absolute bottom-6 right-6 flex h-28 w-40 items-end gap-2 rounded-xl border border-white/20 bg-white/10 p-4"
                  aria-hidden="true"
                >
                  <span className="h-[35%] flex-1 rounded-t bg-white/50" />
                  <span className="h-[56%] flex-1 rounded-t bg-white/70" />
                  <span className="h-[78%] flex-1 rounded-t bg-white" />
                  <span className="h-[48%] flex-1 rounded-t bg-white/60" />
                  <span className="h-[90%] flex-1 rounded-t bg-white" />
                </div>
              </BenefitCard>
            </Reveal>
            <Reveal className="lg:col-span-7">
              <BenefitCard
                className="min-h-[300px] bg-sand-deep"
                icon={<Settings2 size={20} aria-hidden="true" />}
                title="Atualize seu cardápio facilmente"
                description="Mantenha produtos, categorias, mídia e preços sob controle — publique só quando estiver pronto."
              >
                <div
                  className="absolute bottom-6 right-6 hidden items-center gap-2 rounded-xl border border-ink/10 bg-cream/70 px-4 py-3 text-xs font-semibold text-ink-soft sm:flex"
                  aria-hidden="true"
                >
                  <span className="h-2 w-2 rounded-full bg-herb" /> Rascunho pronto para publicar
                </div>
              </BenefitCard>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-cream" aria-labelledby="steps-title">
        <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <Reveal className="max-w-2xl">
            <h2
              id="steps-title"
              className="font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
            >
              Da primeira foto ao próximo cliente em três movimentos.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-0 border-y border-line md:grid-cols-3">
            <Step
              number="01"
              icon={<BookOpen size={21} aria-hidden="true" />}
              title="Crie seu cardápio"
              description="Cadastre categorias, produtos, preços, disponibilidade e mídias em um espaço organizado."
            />
            <Step
              number="02"
              icon={<Palette size={21} aria-hidden="true" />}
              title="Personalize a experiência"
              description="Defina identidade, aparência e a ordem em que seus produtos aparecem para o público."
            />
            <Step
              number="03"
              icon={<QrCode size={21} aria-hidden="true" />}
              title="Compartilhe com seus clientes"
              description="Publique uma versão imutável, gere o acesso público e leve o menu para a mesa."
            />
          </div>
        </div>
      </section>

      <section className="bg-ink text-cream" aria-labelledby="analytics-title">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10">
          <Reveal>
            <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              <span className="h-px w-8 bg-accent" aria-hidden="true" /> Leitura da operação
            </p>
            <h2
              id="analytics-title"
              className="max-w-[9ch] font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
            >
              Não adivinhe o que chamou atenção.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-cream/70">
              O painel de analytics reúne os sinais anônimos da navegação para você entender como o
              cardápio está sendo explorado.
            </p>
            <div className="mt-8 flex items-start gap-3 text-sm text-cream/80">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream/10 text-accent">
                <MousePointerClick size={16} aria-hidden="true" />
              </span>
              <span>
                Sem inventar resultado: os dados aparecem quando o seu menu publicado começa a
                receber visitas.
              </span>
            </div>
          </Reveal>
          <Reveal>
            <AnalyticsPreview />
          </Reveal>
        </div>
      </section>

      <section id="faq" className="bg-cream" aria-labelledby="faq-title">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24 lg:px-10">
          <Reveal>
            <h2
              id="faq-title"
              className="max-w-[7ch] font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
            >
              Perguntas que aparecem antes do primeiro acesso.
            </h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-ink-soft">
              Se a sua dúvida não estiver aqui, fale com a gente.
            </p>
          </Reveal>
          <Reveal className="border-t border-line">
            {faqs.map((faq, index) => {
              const expanded = openFaq === index;
              return (
                <div key={faq.question} className="border-b border-line">
                  <button
                    type="button"
                    className="flex min-h-[72px] w-full items-center justify-between gap-5 text-left text-[15px] font-semibold text-ink"
                    aria-expanded={expanded}
                    onClick={() => setOpenFaq(expanded ? null : index)}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={19}
                      className={`shrink-0 text-ink-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {expanded ? (
                    <p className="max-w-2xl pb-6 pr-10 text-sm leading-6 text-ink-soft">
                      {faq.answer}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>

      <section id="contato" className="bg-accent-deep text-white" aria-labelledby="contact-title">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-20 sm:px-8 sm:py-24 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <Reveal>
            <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              <span className="h-px w-8 bg-white/70" aria-hidden="true" /> Vamos conversar
            </p>
            <h2
              id="contact-title"
              className="max-w-[11ch] font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-6xl"
            >
              Ainda tem alguma dúvida?
            </h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/75">
              Conte um pouco sobre o seu restaurante e o que você espera de um cardápio melhor.
            </p>
          </Reveal>
          <Reveal>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-accent-deep transition hover:bg-cream active:scale-[0.98]"
              onClick={() => setContactOpen(true)}
            >
              Falar com a gente <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </Reveal>
        </div>
      </section>

      <section className="bg-ink text-cream" aria-labelledby="closing-title">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-8 px-5 py-20 sm:px-8 sm:py-28 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div>
            <h2
              id="closing-title"
              className="max-w-[12ch] font-serif text-5xl leading-[0.94] tracking-[-0.025em] sm:text-7xl"
            >
              Seu cardápio pode ser mais que uma lista de produtos.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-cream/65">
              Pode ser o primeiro convite para conhecer o seu restaurante.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <LandingButton href="/plans" variant="light">
              Ver planos <ArrowRight size={18} aria-hidden="true" />
            </LandingButton>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-cream transition hover:bg-cream/10"
              onClick={() => setContactOpen(true)}
            >
              Falar com a gente <MessageCircle size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <footer
        id="footer"
        className="border-t border-cream/10 bg-ink px-5 py-10 text-cream sm:px-8 lg:px-10"
      >
        <div className="mx-auto grid max-w-[1240px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream font-serif text-xl text-ink">
                P
              </span>
              <span className="text-sm font-semibold tracking-[0.18em]">PRATTO</span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-6 text-cream/55">
              Cardápios digitais que dão vontade de explorar.
            </p>
          </div>
          <FooterColumn title="Produto">
            <FooterLink href="#produto">Produto</FooterLink>
            <FooterLink href="#recursos">Recursos</FooterLink>
            <FooterLink href="/plans">Planos</FooterLink>
          </FooterColumn>
          <FooterColumn title="Explore">
            <FooterLink href="#como-funciona">Como funciona</FooterLink>
            <FooterLink href="#faq">FAQ</FooterLink>
            <FooterLink href="#contato">Contato</FooterLink>
          </FooterColumn>
          <FooterColumn title="Acesso">
            <FooterLink href="/login">Entrar</FooterLink>
            <FooterLink href="/terms">Termos</FooterLink>
            <FooterLink href="/privacy">Privacidade</FooterLink>
          </FooterColumn>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1240px] flex-col gap-2 border-t border-cream/10 pt-5 text-xs text-cream/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Pratto.</span>
          <span>Uma experiência visual para descobrir pratos.</span>
        </div>
      </footer>

      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} />
    </main>
  );
}

function LandingNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-sm font-medium text-ink-soft transition hover:text-ink">
      {children}
    </a>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="rounded-xl px-3 py-3 text-sm font-semibold text-ink transition hover:bg-sand"
    >
      {children}
    </a>
  );
}

function LandingButton({
  href,
  children,
  variant = 'primary',
  size = 'large',
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'light';
  size?: 'small' | 'large';
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] ${size === 'small' ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-sm'} ${variant === 'light' ? 'bg-cream text-ink hover:bg-white' : 'bg-accent-deep text-white shadow-[0_14px_30px_-16px_var(--color-accent)] hover:bg-ink'}`}
    >
      {children}
    </a>
  );
}

function HeroMenuPreview() {
  return (
    <div className="relative mx-auto aspect-[390/650] w-full max-w-[390px] rounded-[40px] border border-line bg-sand p-3 shadow-[0_40px_80px_-30px_rgba(24,23,22,.32)] sm:p-4">
      <div
        className="absolute -left-4 top-10 hidden h-20 w-20 rounded-full border border-accent/30 sm:block"
        aria-hidden="true"
      />
      <div
        className="absolute -right-5 bottom-16 hidden h-28 w-28 rounded-full border border-herb/30 sm:block"
        aria-hidden="true"
      />
      <div className="relative h-full overflow-hidden rounded-[30px] bg-ink">
        <Image
          src={dishImages.main}
          alt="Exemplo de prato em destaque no cardápio Pratto"
          fill
          priority
          sizes="(min-width: 1024px) 390px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/15 via-transparent to-ink" />
        <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">
              Menu do restaurante
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-accent-deep">
              Populares
            </span>
          </div>
          <div className="max-w-[290px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              BURGERS
            </p>
            <h2 className="mt-2 font-serif text-5xl leading-[0.88] sm:text-6xl">Smash Bacon</h2>
            <p className="mt-4 text-sm leading-5 text-white/80">
              Uma leitura visual do prato, com espaço para detalhe e desejo.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink">
                Ver detalhes
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30">
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/20 pt-4 text-center text-[10px] font-medium text-white/70">
            <span className="flex flex-col items-center gap-1">
              <UtensilsCrossed size={17} />
              Menu
            </span>
            <span className="flex flex-col items-center gap-1">
              <Grid2X2 size={17} />
              Categorias
            </span>
            <span className="flex flex-col items-center gap-1">
              <Store size={17} />
              Restaurante
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemTile({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-cream p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand text-accent-deep">
        {icon}
      </span>
      <h3 className="mt-6 font-serif text-3xl leading-none">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{description}</p>
    </div>
  );
}

function ListIcon() {
  return (
    <span className="flex flex-col gap-1.5" aria-hidden="true">
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-3 rounded-full bg-current" />
      <span className="h-0.5 w-4 rounded-full bg-current" />
    </span>
  );
}

function ShowcaseMenuPreview({ activeTab }: { activeTab: ShowcaseTab }) {
  return (
    <div
      id="product-preview"
      className="relative mx-auto w-full max-w-[420px] rounded-[32px] border border-line bg-sand p-3 shadow-[0_28px_70px_-36px_rgba(24,23,22,.48)] sm:p-4"
      role="tabpanel"
      aria-label={`${showcaseCopy[activeTab].title} — prévia ilustrativa`}
    >
      <div className="relative aspect-[0.76] overflow-hidden rounded-[26px] bg-ink text-white">
        <PreviewImage activeTab={activeTab} />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/15 via-transparent to-ink/95" />
        <div className="relative flex h-full flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Pratto / demonstração
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-accent-deep">
              {activeTab === 'sharing' ? 'Compartilhe' : 'Explorar'}
            </span>
          </div>
          {activeTab === 'categories' ? (
            <CategoryPreview />
          ) : activeTab === 'search' ? (
            <SearchPreview />
          ) : activeTab === 'sharing' ? (
            <SharePreview />
          ) : (
            <div className="max-w-[250px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                {activeTab === 'featured' ? 'Escolha da casa' : 'BURGERS'}
              </p>
              <h3 className="mt-2 font-serif text-4xl leading-[0.88]">
                {activeTab === 'featured' ? 'O que merece destaque.' : 'Descubra no seu ritmo.'}
              </h3>
              <p className="mt-3 text-sm leading-5 text-white/80">
                {activeTab === 'featured'
                  ? 'Dê mais espaço aos produtos que você quer apresentar.'
                  : 'Foto, contexto e navegação em uma única experiência.'}
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center text-[10px] font-medium text-white/70">
            <span className="flex flex-col items-center gap-1">
              <UtensilsCrossed size={16} />
              Menu
            </span>
            <span className="flex flex-col items-center gap-1">
              <Grid2X2 size={16} />
              Categorias
            </span>
            <span className="flex flex-col items-center gap-1">
              <Store size={16} />
              Restaurante
            </span>
          </div>
        </div>
      </div>
      <p className="px-2 pb-1 pt-3 text-center text-[11px] text-ink-faint">
        Prévia ilustrativa da experiência pública
      </p>
    </div>
  );
}

function PreviewImage({ activeTab }: { activeTab: ShowcaseTab }) {
  const src =
    activeTab === 'categories'
      ? dishImages.salad
      : activeTab === 'sharing'
        ? dishImages.dessert
        : activeTab === 'search'
          ? dishImages.pizza
          : dishImages.main;
  return (
    <Image
      key={src}
      src={src}
      alt=""
      fill
      sizes="(min-width: 1024px) 420px, 100vw"
      className="object-cover transition-opacity duration-500"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}

function CategoryPreview() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <PreviewTile image={dishImages.main} label="Entradas" />
      <PreviewTile image={dishImages.pizza} label="Principais" />
      <PreviewTile image={dishImages.salad} label="Saladas" />
      <PreviewTile image={dishImages.dessert} label="Doces" />
    </div>
  );
}

function PreviewTile({ image, label }: { image: string; label: string }) {
  return (
    <div className="relative aspect-[1.18] overflow-hidden rounded-xl bg-white/10">
      <Image
        src={image}
        alt=""
        fill
        sizes="180px"
        className="object-cover opacity-85"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
      <span className="absolute bottom-3 left-3 text-sm font-semibold">{label}</span>
    </div>
  );
}

function SearchPreview() {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm text-ink">
        <Search size={16} className="text-ink-faint" aria-hidden="true" />
        <span>buscar no cardápio</span>
      </div>
      <div className="mt-4 space-y-2">
        <SearchRow image={dishImages.pizza} title="Pizza da casa" />
        <SearchRow image={dishImages.main} title="Smash Bacon" />
        <SearchRow image={dishImages.salad} title="Bowl verde" />
      </div>
    </div>
  );
}

function SearchRow({ image, title }: { image: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-ink/25 p-2">
      <Image
        src={image}
        alt=""
        width={40}
        height={40}
        sizes="40px"
        className="h-10 w-10 rounded-lg object-cover"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <span className="text-sm font-semibold">{title}</span>
      <ArrowUpRight size={15} className="ml-auto text-white/60" aria-hidden="true" />
    </div>
  );
}

function SharePreview() {
  return (
    <div className="mx-auto w-full max-w-[220px] rounded-2xl bg-cream p-4 text-center text-ink">
      <div
        className="mx-auto grid h-32 w-32 grid-cols-7 gap-1 rounded-lg bg-ink p-2"
        aria-hidden="true"
      >
        {Array.from({ length: 49 }, (_, index) => (
          <span
            key={index}
            className={
              (index * 7 + index) % 5 === 0 || index % 9 === 0
                ? 'rounded-[1px] bg-cream'
                : 'rounded-[1px] bg-ink-soft'
            }
          />
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold">Aponte a câmera e explore</p>
      <p className="mt-1 text-xs text-ink-faint">URL pública ou QR Code</p>
    </div>
  );
}

function BenefitCard({
  className,
  icon,
  title,
  description,
  children,
  dark,
}: {
  className: string;
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <article className={`relative overflow-hidden rounded-2xl p-7 sm:p-9 ${className}`}>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${dark ? 'bg-white/10 text-accent' : 'bg-sand text-accent-deep'}`}
      >
        {icon}
      </span>
      <div className="relative z-10 max-w-[360px]">
        <h3 className="mt-8 font-serif text-4xl leading-[0.92]">{title}</h3>
        <p className={`mt-4 text-sm leading-6 ${dark ? 'text-white/65' : 'text-ink-soft'}`}>
          {description}
        </p>
      </div>
      {children}
    </article>
  );
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-line py-8 md:border-b-0 md:border-r md:px-8 md:py-10 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-accent-deep">
          {number}
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand text-accent-deep">
          {icon}
        </span>
      </div>
      <h3 className="mt-10 font-serif text-4xl leading-none">{title}</h3>
      <p className="mt-4 max-w-xs text-sm leading-6 text-ink-soft">{description}</p>
    </div>
  );
}

function AnalyticsPreview() {
  const metrics = [
    { label: 'Acessos', icon: <LayoutDashboard size={16} aria-hidden="true" /> },
    { label: 'Visualizações', icon: <EyeIcon /> },
    { label: 'Interações', icon: <MousePointerClick size={16} aria-hidden="true" /> },
    { label: 'Cliques em contato', icon: <Phone size={16} aria-hidden="true" /> },
  ];
  return (
    <div className="rounded-2xl border border-cream/15 bg-cream/[0.06] p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-cream/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/50">
            Painel de analytics
          </span>
          <h3 className="mt-2 font-serif text-3xl">Visão geral</h3>
        </div>
        <span className="rounded-full border border-accent/40 px-3 py-1.5 text-[11px] font-semibold text-accent">
          visual ilustrativo
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl border border-cream/10 bg-cream/[0.04] p-4 sm:col-span-1">
          <div className="flex items-center justify-between text-cream/55">
            <span className="flex items-center gap-2 text-xs">
              <BarChart3 size={15} />
              Evolução diária
            </span>
            <span className="text-[10px]">seus dados</span>
          </div>
          <div
            className="mt-7 flex h-24 items-end gap-1.5"
            aria-label="Gráfico ilustrativo sem valores"
          >
            {[32, 48, 38, 64, 50, 76, 58, 86, 68, 92, 72, 84].map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t bg-accent/70"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-cream/10 bg-cream/[0.04] p-3"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream/10 text-accent">
                {metric.icon}
              </span>
              <span className="mt-3 block text-[11px] leading-4 text-cream/55">{metric.label}</span>
              <strong className="mt-1 block text-xl font-semibold text-cream/65">—</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
          <span className="text-xs text-cream/55">Produtos mais vistos</span>
          <div className="mt-4 h-2 rounded-full bg-cream/10" />
          <div className="mt-2 h-2 w-3/4 rounded-full bg-cream/10" />
          <div className="mt-2 h-2 w-1/2 rounded-full bg-cream/10" />
        </div>
        <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
          <span className="text-xs text-cream/55">Categorias populares</span>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-8 flex-1 rounded-lg bg-accent/60" />
            <span className="h-8 w-1/2 rounded-lg bg-cream/15" />
            <span className="h-8 w-1/3 rounded-lg bg-cream/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <span className="relative block h-4 w-4" aria-hidden="true">
      <span className="absolute inset-x-0 top-1.5 h-2.5 rounded-[50%] border border-current" />
      <span className="absolute left-1.5 top-2 h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
        {title}
      </h3>
      <div className="mt-4 flex flex-col items-start gap-3">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-sm text-cream/65 transition hover:text-cream">
      {children}
    </a>
  );
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} landing-reveal ${visible ? 'landing-reveal-visible' : ''}`}
    >
      {children}
    </div>
  );
}

function ContactDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'not-configured' | 'copied'>('idle');
  const [form, setForm] = useState({ name: '', establishment: '', contact: '', message: '' });
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const update = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = `Interesse no Pratto — ${form.establishment || form.name}`;
    const body = `Nome: ${form.name}\nEstabelecimento: ${form.establishment}\nContato: ${form.contact}\n\n${form.message}`;
    if (!contactEmail) {
      setStatus('not-configured');
      return;
    }
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const copyMessage = async () => {
    const body = `Nome: ${form.name}\nEstabelecimento: ${form.establishment}\nContato: ${form.contact}\n\n${form.message}`;
    try {
      await navigator.clipboard.writeText(body);
      setStatus('copied');
    } catch {
      setStatus('not-configured');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[24px] bg-cream p-6 shadow-[0_28px_70px_-30px_rgba(24,23,22,.6)] sm:rounded-[24px] sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-dialog-title"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
              Contato
            </p>
            <h2 id="contact-dialog-title" className="mt-3 font-serif text-4xl leading-none">
              Vamos conversar sobre o seu menu.
            </h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:bg-sand"
            aria-label="Fechar contato"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form className="mt-8 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-ink">
              Nome
              <input
                ref={firstFieldRef}
                required
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                className="pratto-input mt-2"
                autoComplete="name"
              />
            </label>
            <label className="block text-[13px] font-medium text-ink">
              Estabelecimento
              <input
                required
                value={form.establishment}
                onChange={(event) => update('establishment', event.target.value)}
                className="pratto-input mt-2"
              />
            </label>
          </div>
          <label className="block text-[13px] font-medium text-ink">
            E-mail ou telefone
            <input
              required
              value={form.contact}
              onChange={(event) => update('contact', event.target.value)}
              className="pratto-input mt-2"
              autoComplete="email"
            />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Mensagem
            <textarea
              required
              value={form.message}
              onChange={(event) => update('message', event.target.value)}
              className="pratto-input mt-2 min-h-28"
            />
          </label>
          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-deep px-5 text-sm font-semibold text-white transition hover:bg-ink"
            >
              {contactEmail ? 'Preparar mensagem' : 'Preparar contato'}{' '}
              <Send size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink transition hover:bg-sand"
              onClick={copyMessage}
            >
              Copiar mensagem
            </button>
          </div>
          {status === 'not-configured' ? (
            <p className="rounded-xl bg-sand p-3 text-sm leading-6 text-ink-soft" role="status">
              O canal de envio ainda não foi configurado neste ambiente. Você pode copiar a mensagem
              e encaminhá-la pelo seu canal preferido.
            </p>
          ) : null}
          {status === 'copied' ? (
            <p className="rounded-xl bg-herb/10 p-3 text-sm leading-6 text-herb" role="status">
              Mensagem copiada. Agora é só colar no seu canal de contato.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
