---
name: PRATTO
description: 'Sistema editorial quente para descoberta visual de pratos e operação segura do cardápio.'
colors:
  cream: '#fff9f4'
  sand: '#f3ebe3'
  sand-deep: '#e9ded2'
  ink: '#181716'
  ink-soft: '#4a4642'
  ink-faint: '#746c64'
  accent: '#f45b3d'
  accent-deep: '#c63f25'
  herb: '#3f7652'
  line: '#eadfd4'
typography:
  display:
    fontFamily: 'Instrument Serif, ui-serif, Georgia, serif'
    fontSize: '42px'
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: 'Instrument Serif, ui-serif, Georgia, serif'
    fontSize: '34px'
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: 'Instrument Serif, ui-serif, Georgia, serif'
    fontSize: '30px'
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: 'Instrument Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Instrument Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '11px'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '0.18em'
rounded:
  image: '8px'
  control: '12px'
  surface: '16px'
  sheet: '24px'
  device: '36px'
  pill: '9999px'
spacing:
  half: '4px'
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '20px'
  xl: '24px'
  2xl: '28px'
  3xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent-deep}'
    textColor: '#ffffff'
    rounded: '{rounded.control}'
    height: '44px'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.ink}'
    textColor: '#ffffff'
    rounded: '{rounded.control}'
    height: '44px'
    padding: '0 16px'
  button-soft:
    backgroundColor: '{colors.sand}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    height: '44px'
    padding: '0 16px'
  input:
    backgroundColor: '{colors.cream}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    height: '44px'
    padding: '0 14px'
  panel:
    backgroundColor: '{colors.cream}'
    textColor: '{colors.ink}'
    rounded: '{rounded.surface}'
    padding: '20px'
---

# Design System: PRATTO

## Overview

**Creative North Star: "Editorial de Mesa"**

O PRATTO combina duas expressões do mesmo sistema: no Customer, fotografia de comida em tela cheia, tipografia editorial e controles discretos criam descoberta imersiva; no Admin, os mesmos neutros quentes, tipos e formas viram uma área de trabalho compacta, clara e predominantemente plana. A identidade vem da comida, do contraste creme/tinta e de um único acento controlado — não de decoração ou padrões genéricos de SaaS.

**Características-chave:**

- fotografia `object-cover` e scrims funcionais lideram a experiência pública;
- Instrument Serif identifica títulos; Instrument Sans sustenta toda a operação;
- creme, areia e tinta dominam; o acento é raro e semântico;
- Admin plano por padrão, Customer imersivo e contextual;
- componentes compactos, bordas finas e estados explícitos.

## Colors

A paleta normativa está no frontmatter e corresponde às variáveis de `globals.css`. `cream` é a superfície principal; `sand` e `sand-deep` separam planos; `ink`, `ink-soft` e `ink-faint` formam a hierarquia de texto; `line` desenha bordas de 1 px. `accent`/`accent-deep` servem a ações primárias, seleção, validação e destaques; `herb` comunica aberto, disponível, ativo ou sucesso.

No menu público, `--menu-primary` vem da configuração do estabelecimento e `--menu-primary-deep` é derivado escurecendo os canais RGB por `0.82`. O tema pode ser claro ou escuro, mas a estrutura, a tipografia e os neutros-base não viram um page builder. Cores de gráficos complementares já usadas são terracota (`#e08a4a`), oliva (`#7a8a5c`), argila (`#c96a4a`) e cinza quente (`#a8a099`); warning usa `#c07a1b`.

**The Accent Is Rare Rule.** Fotografia e neutros devem ocupar a maior parte da tela; não espalhe páprica por cards, fundos ou texto sem significado.

**The Semantic Color Rule.** Disponibilidade, erro, sucesso ou alérgenos nunca dependem apenas de cor: combine rótulo, ícone, texto ou estado ARIA.

## Typography

Instrument Serif é editorial, não operacional. Use-a em nome do restaurante, títulos de tela, prato, drawer e sheet. Instrument Sans cobre corpo, controles, tabelas, formulários e navegação.

- **Display:** 42 px/1 para o nome do restaurante na entrada pública.
- **Headline:** 34 px/1.05 para prato no feed e 34 px/1.2 para títulos Admin.
- **Title:** 30 px/1.2 em detalhes; drawers podem usar 24 px e grids públicos 22 px.
- **Body:** 15 px; use line-height relaxado em descrições e texto informativo.
- **Control:** 14–15 px, peso 500–600.
- **Section label:** 11 px, peso 600, uppercase, tracking de 0.14–0.22 em.
- **Price/metrics:** 15–20 px semibold; métricas podem chegar a 30 px. Valores numéricos usam algarismos tabulares (`tnum`).

**The Serif Has One Job Rule.** Nunca use Instrument Serif em botões, campos, tabelas ou texto operacional denso.

## Layout

O ritmo parte de 8 px, aceita meios-passos de 4 px e usa principalmente 8, 12, 16, 20, 24, 28 e 32 px. Controles têm 44 px de altura; botões compactos, 36 px; botões de ícone, 40 × 40 px. Cards usam 20 px de padding. O conteúdo Customer usa 16–20 px nas laterais e 24 px na entrada.

### Customer

- **390 px:** é o layout nativo. A aplicação ocupa toda a largura e `100dvh`, sem moldura, raio externo ou padding de página.
- **1024 e 1440 px:** continua sendo um objeto mobile de 390 × 812 px, centralizado sobre `sand`, com raio de 36 px, ring de 1 px e sombra ambiente. Não vira grid de tablet/desktop.
- O feed é vertical, cada produto ocupa exatamente um viewport, com snap obrigatório no início e `scroll-snap-stop: always`.
- Chips de categoria e galeria usam scroll horizontal nativo com snap; a navegação inferior fixa reserva aproximadamente 96–112 px nos overlays.
- Categorias usam grid de duas colunas, imagens 4:5 e gap de 12 px. O sheet de detalhes ocupa no máximo 88% do viewport.

### Admin

- Workspace `h-screen`, mínimo de 680 px, sidebar fixa e conteúdo principal rolável de forma independente.
- Sidebar expandida: 240 px. Recolhida: 76 px. Recolhe automaticamente abaixo de 1120 px e permanece manualmente alternável.
- Conteúdo central: máximo de 1240 px, padding de 24 px e 40 px a partir de `lg`.
- **1440 px:** sidebar expandida e largura plena para dashboards, tabelas e previews lado a lado.
- **1024 px:** sidebar de 76 px; métricas permanecem utilizáveis, enquanto charts e previews empilham abaixo de `lg`. Tabelas e filtros precisam preservar acesso horizontal/ordem de colunas, nunca cortar ações.
- **390 px:** não é um alvo de operação Admin. Preserve acesso funcional sem redesenhar o Admin como app móvel; o Customer é a superfície mobile prioritária.

**The One Customer Renderer Rule.** A prévia Admin deve reutilizar a apresentação pública real; não mantenha um segundo menu mockado.

## Elevation & Depth

O Admin é plano por padrão: superfícies tonais e bordas `line` de 1 px definem a hierarquia. Sombras aparecem apenas quando há elevação física ou estado transitório.

- Botão primário: `0 8px 20px -12px var(--color-accent)`.
- Moldura Customer: `0 40px 80px -30px rgba(24,23,22,.45)`.
- CTA Customer: `0 14px 30px -12px var(--menu-primary)`.
- Logo de entrada: `0 18px 40px -18px rgba(24,23,22,.6)`.
- Toast: `0 12px 30px -12px rgba(24,23,22,.35)`.
- Toggle: `0 1px 3px rgba(24,23,22,.35)` no thumb.
- Drawers, dialogs, sheets e item arrastado podem elevar; cards persistentes não flutuam.

**The Flat-At-Rest Rule.** Não aplique sombras decorativas em todos os cards; reserve profundidade para frame, overlay, drag, feedback e ação principal pública.

## Shapes

Controles e campos usam 12 px; painéis, cards, tabelas, tiles e dialogs, 16 px; topo do sheet e blocos de marca, 24 px; moldura Customer, 36 px; thumbnails, 8 px. Use círculo em botões de ícone e pill apenas para filtros, preço, status ou seleção compacta — nunca como forma padrão de todo container.

Ícones são Lucide com traço normalmente entre 1.7 e 2.2; navegação ativa pode engrossar levemente o traço. Fotografias são recortadas em alta ocupação e falhas mostram placeholder quente com ícone e texto, nunca o ícone quebrado do navegador.

## Components

### Buttons

Variantes implementadas: solid, soft, ghost, outline e ink. Todas usam raio de 12 px, peso 500, transição de 150 ms, escala pressionada `0.98` e opacidade desabilitada de 45%; icon buttons medem 40 px e pressionam a `0.95`. O solid é a ação primária acentuada; ink representa ação forte neutra; soft, ghost e outline reduzem hierarquia.

### Fields and toggles

Inputs, selects e textareas usam `cream`, borda `line`, raio de 12 px, texto 15 px e foco com borda forte mais ring de acento. Labels e mensagens têm 13 px; erro combina borda, ícone e texto `accent-deep`. O toggle mede 44 × 24 px, thumb 20 px; `herb` é on e `sand-deep` é off.

### Panels and feedback

`pratto-panel` é `cream`, borda de 1 px e raio de 16 px. Skeleton preserva geometria com shimmer de 1.4 s. Empty state usa tile de 48 px e texto breve; Error state admite retry e variante escura. `FoodImage` cobre loading, reveal de 500 ms e falha de imagem com fallback de marca.

### Navigation and Customer patterns

No Admin, item ativo usa `ink`/branco; hover neutro usa `sand`. No Customer, a navegação inferior tem três destinos — Menu, Categorias e Restaurante — e alterna entre scrim escuro no feed e superfície translúcida nos demais contextos. Chips são pills roláveis: selecionado branco com texto no acento profundo; não selecionado translúcido sobre fotografia.

### Overlays and states

Sheets e dialogs usam `role="dialog"`, `aria-modal`, foco inicial, trap de Tab, Escape, bloqueio de scroll e retorno ao foco anterior. Loading, vazio, erro, retry, indisponível, disabled, saving/uploading e sucesso devem manter espaço, ação e mensagem coerentes. Navegação e filtros expõem `aria-current`/`aria-pressed`; feeds e carregamentos usam `aria-busy` e roles adequados.

Movimento é curto e funcional: botões/chips 150 ms, toggle 200 ms, troca de categoria 280 ms com fade + 6 px, sheet 300 ms, imagem 500 ms e skeleton 1.4 s. O feed é movido por scroll e snap, não por slideshow; o item ativo escala até 1.06 e o texto responde à posição. Com `prefers-reduced-motion`, animações e transições caem para 0.01 ms, scroll suave é removido e vídeo não reproduz automaticamente.

## Do's and Don'ts

### Do

- **Do** preserve a seleção explícita e visível de `menuId`; comece em “Selecione um menu” e bloqueie operações até haver alvo válido.
- **Do** preserve preços DECIMAL como strings do contrato ao formulário/API; converta apenas para apresentação e use algarismos tabulares.
- **Do** trate publicação como criação idempotente de um novo snapshot imutável; alterações pertencem ao rascunho e nunca reescrevem versões históricas.
- **Do** mantenha tema claro/escuro e cor configurável dentro de uma estrutura fixa, com validação de contraste para acentos customizados.
- **Do** preserve imagens e vídeos ordenados, mídia principal, estados reais de disponibilidade e todos os caminhos de loading/empty/error/retry.
- **Do** valide Customer em 390 px e Admin em 1024/1440 px, incluindo teclado, contraste e movimento reduzido.

### Don't

- **Don't** selecione implicitamente o primeiro menu, invente tenant no cliente ou esconda o contexto de edição.
- **Don't** transforme preço em `number`, disponibilidade em booleano simples ou publicação em objeto local mutável para acomodar mocks.
- **Don't** duplique o renderer Customer na prévia Admin nem substitua a galeria nativa com snap por transformações frágeis.
- **Don't** use pills, sombras, acento ou serif como decoração generalizada.
- **Don't** introduza branco/cinza frio genérico, dashboards SaaS indiferenciados ou gradientes fora de scrims de legibilidade e transições fotográficas.
- **Don't** adicione carrinho, pedido, checkout, quantidade ou CTA de compra ao fluxo público.
