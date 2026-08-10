# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Clientes que chegam ao cardápio por URL ou QR Code em um celular e querem descobrir pratos visualmente, consultar detalhes e entender o restaurante sem iniciar uma compra.
- Proprietários e administradores de estabelecimentos que configuram o restaurante, mantêm categorias, produtos e mídias, publicam versões do cardápio e acompanham analytics anônimos.

## Product Purpose

O PRATTO é um cardápio digital mobile-first que transforma a navegação por pratos em uma experiência visual vertical. O produto permite ao estabelecimento administrar seu catálogo e identidade, publicar uma versão imutável, compartilhá-la por URL ou QR Code e acompanhar como visitantes anônimos exploram o menu.

Sucesso significa que o operador consegue concluir o fluxo de login, configuração, catálogo, mídia, publicação e acompanhamento sem perder contexto de organização, estabelecimento ou menu; e que o cliente consegue entrar, navegar, filtrar, abrir detalhes e consultar o restaurante com fluidez em um celular.

## Positioning

O mecanismo próprio do PRATTO é combinar publicação versionada de um catálogo administrável com descoberta pública de pratos em um feed vertical imersivo, mantendo o foco em exploração e apresentação — não em pedidos ou transações.

## Operating Context

- O produto é desenvolvido localmente em um monorepo TypeScript com Next.js e NestJS, preparado para evolução SaaS sem reescrever o núcleo.
- O Admin opera com sessão autenticada, organização ativa, estabelecimento autorizado e seleção explícita do menu editável.
- O cliente normalmente chega por um link compartilhado ou QR Code e navega em um viewport móvel.
- Publicações são snapshots históricos imutáveis; alterações no rascunho só chegam ao público após uma nova publicação.

## Capabilities and Constraints

- Autenticação por sessão opaca em cookie HttpOnly, seleção de organização e isolamento multi-tenant derivado da sessão.
- Configurações do estabelecimento, endereço estruturado, horários, logo, capa, tema e cor principal.
- Categorias, produtos, preços decimais como strings, estados de disponibilidade, destaque, ingredientes e alergênicos.
- Mídias ordenadas de imagem e vídeo, com definição de principal e fluxo real de upload e remoção.
- Publicação idempotente e versionada, histórico imutável, URL pública, QR Code e compartilhamento.
- Feed vertical com snap obrigatório, galeria horizontal, filtros por categoria, detalhes, analytics anônimos, estados de carregamento, vazio, erro e indisponibilidade.
- O produto não inclui carrinho, checkout, pagamento, pedidos, entrega, seletores de quantidade, login de cliente, favoritos, avaliações, recomendações ou CTAs de compra.
- A arquitetura real, contratos, regras de autorização, tenant isolation, rotas e integrações backend não podem ser alterados para acomodar modelos mockados da referência.

## Brand Commitments

- O nome do produto é PRATTO.
- `design-reference/`, `design-reference/screenshots/` e `docs/design-reference-analysis.md` são a fonte aprovada de verdade visual e de interação para o redesign completo do frontend.
- A referência define uma experiência editorial quente orientada por fotografia no Customer e uma operação Admin compacta e coerente; ela não autoriza copiar o mock store ou substituir a arquitetura real.

## Evidence on Hand

- Aplicação real e contratos em `apps/web/`, `packages/contracts/`, `packages/validation/` e APIs existentes.
- Critérios e arquitetura em `docs/product/`, `docs/architecture/`, `docs/adr/` e `docs/Pratto-Plano-de-Implementacao-e-Arquitetura.md`.
- Implementação visual de referência em `design-reference/src/`.
- Capturas aprovadas em `design-reference/screenshots/` para Customer em 390 × 812 px e Admin em 1440, 1280 e 1024 px.
- Análise de tradução visual, diferenças de contrato, defeitos conhecidos e guardrails em `docs/design-reference-analysis.md`.

## Product Principles

1. Descoberta visual primeiro: fotografia, navegação e informação do prato lideram a experiência pública.
2. Operação explícita e segura: organização, estabelecimento e menu permanecem claros, e nenhuma mutação usa seleção implícita de tenant ou menu.
3. Publicação é histórico: rascunhos evoluem, versões publicadas não são reescritas.
4. Design traduz contratos reais: a interface se adapta ao domínio existente sem inventar campos, estados ou capacidades.
5. Produto focado: explorar e apresentar o menu com excelência, sem expandir para comércio ou pedidos.

## Accessibility & Inclusion

- Preservar semântica, navegação por teclado, nomes acessíveis, foco visível, gestão de foco em superfícies modais, anúncios de estados e suporte a movimento reduzido.
- Não comunicar disponibilidade, sucesso, alerta ou alergênicos somente por cor.
- Validar contraste de cores configuráveis e manter alvos de toque confortáveis no Customer.
