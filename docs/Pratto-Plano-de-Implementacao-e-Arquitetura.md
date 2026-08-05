# Pratto — Plano de Implementação, Arquitetura e Evolução

## 1. Contexto do projeto

O Pratto será desenvolvido inicialmente como um projeto de portfólio, executado localmente, sem dependência obrigatória de serviços externos como Cloudflare, Stripe, provedores gerenciados de banco, filas ou e-mail.

A arquitetura deverá demonstrar boas práticas de engenharia, separação de responsabilidades, organização modular, segurança, testes, documentação e capacidade de evolução.

Caso o projeto futuramente seja transformado em um SaaS real, as integrações locais deverão poder ser substituídas por serviços de produção sem exigir reescrita completa do sistema.

O diferencial central continua sendo:

> Um cardápio digital mobile-first, visual, rápido e baseado em navegação vertical por produtos.

---

# 2. Estratégia geral

O projeto será desenvolvido em três ciclos:

1. **MVP de portfólio**
2. **Evolução para SaaS demonstrável**
3. **Preparação para produção real**

A prioridade será validar primeiro o produto principal:

- Cadastro de produtos.
- Upload de mídias.
- Publicação do cardápio.
- Feed vertical.
- Navegação horizontal entre mídias.
- Analytics.
- Dashboard.

Funcionalidades comerciais, operacionais e de infraestrutura avançada serão adicionadas somente depois.

---

# 3. Escopo reduzido do MVP de portfólio

## 3.1 Incluído no MVP

### Cardápio público

- Feed vertical de produtos.
- Imagens e vídeos curtos.
- Galeria horizontal por produto.
- Filtro por categoria.
- Detalhes do produto.
- Indicação de promoção.
- Indicação de indisponibilidade.
- Contatos do estabelecimento.
- URL pública por slug.
- QR Code geral.
- Layout mobile-first.
- Carregamento progressivo.
- Navegação sem login.

### Painel administrativo

- Login.
- Logout.
- Recuperação de senha.
- Configuração básica do estabelecimento.
- CRUD de categorias.
- CRUD de produtos.
- Upload de imagens.
- Upload de vídeos curtos.
- Ordenação das mídias.
- Ordenação manual dos produtos.
- Controle de disponibilidade.
- Produtos em rascunho.
- Produtos publicados.
- Publicação do cardápio.
- Dashboard básico.

### Analytics

- Abertura do cardápio.
- Sessões anônimas.
- Impressões de produtos.
- Visualizações qualificadas.
- Abertura dos detalhes.
- Troca de mídias.
- Seleção de categorias.
- Cliques em contatos.
- Produtos mais visualizados.
- Categorias mais acessadas.
- Evolução por período.

---

## 3.2 Fora do MVP inicial

- Assinaturas reais.
- Stripe.
- Cloudflare.
- Múltiplos usuários por estabelecimento.
- Permissões granulares.
- Painel administrativo da plataforma.
- Múltiplas unidades.
- Domínio personalizado.
- Cardápio tradicional.
- Busca.
- Produtos relacionados.
- Comparações avançadas.
- Exportação de relatórios.
- Upload por URL assinada externa.
- Processamento profissional de vídeo.
- Redis.
- Filas.
- Worker separado.
- PWA.
- Carrinho.
- Checkout.
- Pagamentos.
- Pedidos.
- Delivery.
- Retirada.
- Controle de mesas.
- Gestão de cozinha.
- Controle de estoque.
- Integração com PDV.

---

# 4. Decisões arquiteturais

## 4.1 Arquitetura principal

A arquitetura escolhida será:

> **Monólito modular em monorepo.**

O sistema será uma única aplicação de backend organizada internamente em módulos independentes.

Essa decisão oferece:

- Menor complexidade operacional.
- Deploy e execução local mais simples.
- Facilidade de testes.
- Menor custo de manutenção.
- Separação clara de responsabilidades.
- Possibilidade de extrair serviços no futuro.
- Melhor adequação para um projeto de portfólio.

Não serão utilizados inicialmente:

- Microserviços.
- Kubernetes.
- Kafka.
- Event Sourcing.
- CQRS completo.
- GraphQL.
- Banco separado por estabelecimento.
- Arquitetura distribuída.

---

## 4.2 Stack principal

| Área                | Tecnologia                  |
| ------------------- | --------------------------- |
| Linguagem           | TypeScript                  |
| Monorepo            | pnpm workspaces + Turborepo |
| Frontend            | Next.js                     |
| Backend             | NestJS                      |
| API                 | REST + OpenAPI              |
| Banco de dados      | PostgreSQL                  |
| ORM                 | Prisma                      |
| Armazenamento local | MinIO                       |
| Interface           | Tailwind CSS + shadcn/ui    |
| Formulários         | React Hook Form + Zod       |
| Estado remoto       | TanStack Query              |
| Autenticação        | Sessão com cookie HTTP-only |
| Logs                | Pino                        |
| Testes backend      | Jest                        |
| Testes frontend     | Vitest + Testing Library    |
| Testes E2E          | Playwright                  |
| Ambiente local      | Docker Compose              |
| E-mail local        | Mailpit                     |
| CI                  | GitHub Actions              |

---

# 5. Estrutura do monorepo

```text
pratto/
├── apps/
│   ├── web/
│   │   ├── cardápio público
│   │   └── painel administrativo
│   │
│   └── api/
│       └── API NestJS
│
├── packages/
│   ├── database/
│   ├── contracts/
│   ├── validation/
│   ├── ui/
│   ├── config/
│   └── eslint-config/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── product/
│   ├── api/
│   └── diagrams/
│
├── infrastructure/
│   └── docker/
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

O worker não será criado inicialmente.

Ele será adicionado apenas quando existir necessidade real de:

- Processamento assíncrono.
- Conversão de vídeos.
- Geração de miniaturas.
- Agregação de métricas.
- Limpeza automática de arquivos.
- Retentativas.

---

# 6. Módulos do backend

## 6.1 Identity

Responsável por:

- Usuários.
- Login.
- Logout.
- Sessões.
- Recuperação de senha.
- Alteração de senha.
- Auditoria de autenticação.

## 6.2 Organizations

Responsável por:

- Organizações.
- Proprietários.
- Relação entre usuários e organizações.
- Preparação para múltiplos membros no futuro.

## 6.3 Establishments

Responsável por:

- Nome público.
- Descrição.
- Endereço.
- Telefone.
- WhatsApp.
- Horários.
- Redes sociais.
- Logo.
- Imagem de capa.
- Tema.
- Slug público.

## 6.4 Catalog

Responsável por:

- Menus.
- Categorias.
- Produtos.
- Preços.
- Promoções.
- Disponibilidade.
- Destaques.
- Ordenação.
- Publicação.

## 6.5 Media

Responsável por:

- Upload.
- Imagens.
- Vídeos.
- Arquivos.
- Mídia principal.
- Reordenação.
- Remoção.
- Status de processamento.

## 6.6 Public Menu

Responsável por:

- Cardápio público.
- Feed.
- Categorias públicas.
- Snapshot publicado.
- URL pública.
- QR Code.

## 6.7 Analytics

Responsável por:

- Sessões anônimas.
- Eventos.
- Validação.
- Deduplicação.
- Agregação.
- Relatórios.
- Dashboard.

## 6.8 Audit

Responsável por registrar:

- Login.
- Alterações críticas.
- Publicações.
- Exclusões.
- Mudanças de configuração.
- Ações administrativas relevantes.

---

# 7. Multi-tenancy

## 7.1 Estratégia escolhida

Será utilizado:

> Banco compartilhado, schema compartilhado e colunas de organização e estabelecimento.

As tabelas relevantes possuirão:

```text
organization_id
establishment_id
```

Não será utilizado um banco por estabelecimento.

---

## 7.2 Organização e estabelecimento

Organização e estabelecimento serão entidades diferentes.

Exemplo:

```text
Organização: Grupo Restaurante Minas
├── Unidade Centro
├── Unidade Shopping
└── Unidade Cidade Nova
```

Mesmo que o MVP tenha apenas um estabelecimento por organização, o modelo deve estar preparado para múltiplas unidades.

---

## 7.3 Isolamento dos dados

Toda consulta administrativa deverá validar:

- Usuário autenticado.
- Organização atual.
- Estabelecimento atual.
- Permissão para acessar o recurso.

Deverão existir testes garantindo que:

- Organização A não lê dados da organização B.
- Organização A não altera dados da organização B.
- IDs enviados pelo cliente não permitem trocar de tenant.

---

# 8. Autenticação

## 8.1 Estratégia escolhida

A autenticação será baseada em:

- Sessão opaca.
- Cookie `HttpOnly`.
- Cookie `Secure` em produção.
- `SameSite=Lax`.
- Sessão armazenada no PostgreSQL.
- Possibilidade de revogação.
- Proteção CSRF.
- Senhas com Argon2id.
- Tokens de recuperação armazenados como hash.

Não será utilizado inicialmente:

- JWT com refresh token.
- OAuth.
- Login com Google.
- Login com GitHub.
- MFA.

---

# 9. Armazenamento de arquivos

## 9.1 MinIO local

O MinIO será utilizado no ambiente local.

Ele possui compatibilidade com a API S3, permitindo substituir o armazenamento no futuro.

A aplicação deverá usar uma abstração:

```ts
interface StorageService {
  upload(input: UploadInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
```

Implementação inicial:

```text
StorageService
└── MinioStorageService
```

Implementações futuras:

```text
StorageService
├── MinioStorageService
├── CloudflareR2StorageService
└── S3StorageService
```

O domínio não deverá conhecer detalhes do MinIO.

---

# 10. Tratamento de vídeos no MVP

No MVP local:

- Aceitar somente MP4.
- Definir limite de tamanho.
- Definir limite de duração.
- Exigir formato compatível com navegadores.
- Utilizar poster ou imagem de capa.
- Não realizar transcodificação inicialmente.
- Não gerar múltiplas resoluções.
- Não utilizar streaming adaptativo.

Limites sugeridos:

```text
Vídeo:
- Formato MP4
- Até 30 MB
- Até 30 segundos
- Até 2 vídeos por produto
```

Evolução futura:

```text
FFmpeg local
→ worker
→ fila BullMQ
→ geração de versões
→ thumbnails
```

Em produção, o processamento poderá ser substituído por um serviço gerenciado.

---

# 11. Tratamento de imagens

Limites sugeridos:

```text
Imagem:
- JPEG, PNG ou WebP
- Até 5 MB
- Até 10 imagens por produto
```

O sistema deverá:

- Validar MIME type.
- Gerar nomes internos aleatórios.
- Impedir sobrescrita.
- Remover arquivos órfãos.
- Exibir fallback em caso de erro.
- Permitir escolher mídia principal.
- Permitir reordenação.

A otimização avançada poderá ser adicionada depois.

---

# 12. Modelagem do catálogo

## 12.1 Entidades principais

```text
Menu
Category
Product
ProductCategory
ProductMedia
MenuProduct
MenuPublication
```

---

## 12.2 Estados do produto

Estado editorial:

```text
DRAFT
PUBLISHED
ARCHIVED
```

Estado de disponibilidade:

```text
AVAILABLE
TEMPORARILY_UNAVAILABLE
HIDDEN
```

Publicação e disponibilidade devem permanecer separadas.

Um produto pode estar:

- Publicado.
- Visível.
- Temporariamente indisponível.

---

## 12.3 Preços

Os preços deverão ser armazenados como:

```text
DECIMAL
```

Nunca utilizar:

```text
float
double
```

Campos sugeridos:

```text
price
promotional_price
promotion_started_at
promotion_ended_at
```

As datas promocionais podem ficar fora do MVP inicial.

---

## 12.4 Ordenação

No MVP:

- Campo inteiro `position`.
- Reordenação em lote.
- Atualização dentro de transação.
- Ordenação manual.

Não implementar algoritmo de ranking inicialmente.

---

# 13. Publicação do cardápio

## 13.1 Fluxo

```text
Administrador edita
        ↓
Conteúdo permanece em rascunho
        ↓
Administrador publica
        ↓
Sistema valida o catálogo
        ↓
Cria uma nova MenuPublication
        ↓
Cardápio público utiliza a nova versão
```

---

## 13.2 Snapshot

A publicação deverá criar um snapshot:

```text
MenuPublication
├── id
├── menu_id
├── version
├── snapshot_json
├── published_at
└── published_by
```

Vantagens:

- Evita publicação parcial.
- Evita consultas complexas em cada acesso.
- Facilita cache futuro.
- Facilita rollback.
- Prepara o sistema para CDN.
- Garante consistência do cardápio público.

---

# 14. URLs públicas e QR Codes

Formato recomendado:

```text
/menu/{publicId}/{slug}
```

Exemplo:

```text
/menu/7GHT92/pratto-burger
```

O `publicId` será imutável.

O slug poderá ser alterado.

O QR Code deverá utilizar o identificador estável, garantindo que continue funcionando após mudanças de nome ou slug.

---

# 15. Arquitetura do feed

## 15.1 Estratégia de renderização

O feed não deverá renderizar todos os produtos simultaneamente.

Manter aproximadamente:

- Produto anterior.
- Produto atual.
- Dois próximos produtos.

Os demais produtos podem permanecer apenas como dados.

---

## 15.2 Carregamento inicial

No primeiro acesso:

- Dados do estabelecimento.
- Categorias.
- Primeiros produtos.
- Mídia principal do primeiro produto.

Durante a navegação:

- Pré-carregar o próximo produto.
- Pausar o vídeo anterior.
- Remover mídias distantes.
- Carregar novos produtos por cursor.

---

## 15.3 Paginação

Utilizar paginação por cursor.

Exemplo:

```http
GET /public/menus/{id}/products?cursor=abc123&limit=10
```

Não utilizar offset para o feed público.

---

## 15.4 Regras de vídeo

- Apenas um vídeo reproduzindo.
- Vídeo sem áudio por padrão.
- Pausar ao sair da viewport.
- Utilizar poster.
- Não iniciar antes de estar visível.
- Respeitar `prefers-reduced-motion`.
- Possuir controle de áudio.
- Evitar reprodução simultânea.

---

## 15.5 Navegação

### Vertical

- Próximo produto.
- Produto anterior.
- Scroll snapping.
- Preservação da posição.

### Horizontal

- Troca de imagens.
- Troca de vídeos.
- Indicador da mídia atual.
- Tratamento do conflito entre gesto horizontal e vertical.

---

# 16. Analytics

## 16.1 Eventos iniciais

```text
menu_opened
product_impression
product_viewed
product_detail_opened
product_media_changed
category_selected
contact_clicked
session_ended
```

---

## 16.2 Definições

### Impressão

Produto ocupou pelo menos 50% da viewport durante 500 ms.

### Visualização qualificada

Produto ocupou pelo menos 70% da viewport durante dois segundos.

### Clique

Ação explícita realizada pelo visitante.

### Sessão

Conjunto de interações anônimas de um visitante.

A sessão poderá ser encerrada após período de inatividade.

---

## 16.3 Estrutura de evento

```json
{
  "eventId": "uuid",
  "eventType": "product_viewed",
  "establishmentId": "public-id",
  "productId": "public-id",
  "sessionId": "anonymous-id",
  "occurredAt": "timestamp",
  "metadata": {
    "categoryId": "public-id",
    "position": 4,
    "viewMode": "feed"
  }
}
```

---

## 16.4 Fluxo dos eventos

```text
Navegador
   ↓
Acumula eventos
   ↓
Envia em lote
   ↓
Endpoint de ingestão
   ├── valida
   ├── deduplica
   └── grava evento bruto
          ↓
Agregação
          ↓
Dashboard
```

---

## 16.5 Privacidade

Não coletar:

- Nome.
- E-mail.
- Localização precisa.
- Identificadores pessoais.
- Fingerprinting invasivo.

Os eventos deverão ser anônimos sempre que possível.

---

# 17. Plano completo de implementação

# CICLO 1 — MVP de portfólio

## Fase 0 — Fonte da verdade

### Objetivo

Eliminar decisões ambíguas antes da implementação.

### Entregáveis

- Visão do produto.
- Escopo incluído.
- Escopo excluído.
- Regras de negócio.
- Critérios de aceite.
- Arquitetura C4.
- Modelo de dados.
- Dicionário de eventos.
- Fluxo de publicação.
- Fluxo de upload.
- Matriz inicial de acesso.
- Backlog.
- ADRs.

### ADRs iniciais

```text
ADR-001 — Uso de monólito modular
ADR-002 — Uso de monorepo
ADR-003 — REST em vez de GraphQL
ADR-004 — PostgreSQL como banco principal
ADR-005 — Multi-tenancy por colunas
ADR-006 — MinIO por abstração de storage
ADR-007 — Sessão baseada em cookie
ADR-008 — Publicação por snapshot
ADR-009 — Analytics próprio no PostgreSQL
ADR-010 — Serviços externos fora do MVP
```

### Critério de conclusão

Não existir dúvida relevante sobre:

- Entidades.
- Estados.
- Escopo.
- Regras.
- Fluxos.
- Ordem de implementação.

---

## Fase 1 — Fundação técnica

### Implementações

- Inicializar monorepo.
- Criar aplicação Next.js.
- Criar aplicação NestJS.
- Configurar PostgreSQL.
- Configurar Prisma.
- Configurar MinIO.
- Configurar Mailpit.
- Criar Docker Compose.
- Configurar variáveis de ambiente.
- Configurar lint.
- Configurar formatação.
- Configurar testes.
- Configurar GitHub Actions.
- Criar endpoint de health check.
- Configurar Swagger.
- Configurar logs estruturados.
- Criar tratamento global de erros.

### Serviços locais

```text
PostgreSQL
MinIO
Mailpit
API
Web
```

### Comandos esperados

```bash
docker compose up -d
pnpm dev
```

### Critério de conclusão

Funcionarem:

- Frontend.
- API.
- Swagger.
- PostgreSQL.
- MinIO.
- Mailpit.
- Health check.

---

## Fase 2 — Domínio e banco de dados

### Entidades iniciais

```text
User
Session
Organization
Membership
Establishment
Menu
Category
Product
ProductCategory
ProductMedia
MenuProduct
MenuPublication
AnalyticsSession
AnalyticsEvent
```

### Implementações

- Schema Prisma.
- Migrations.
- Constraints.
- Índices.
- Seed demonstrativo.
- Factories de testes.
- Serviços de persistência.
- Testes de isolamento.

### Seed recomendado

Criar dois estabelecimentos:

```text
Pratto Burger
Café Aurora
```

### Comandos esperados

```bash
pnpm db:reset
pnpm db:seed
```

### Critério de conclusão

O banco deverá ser recriável integralmente.

---

## Fase 3 — Autenticação e isolamento

### Implementações

- Usuário inicial por seed.
- Login.
- Logout.
- Sessão em cookie HTTP-only.
- Renovação da sessão.
- Recuperação de senha.
- Alteração de senha.
- Middleware de autenticação.
- Contexto de organização.
- Guard de organização.
- Proteção CSRF.
- Rate limit de login.
- Hash Argon2id.
- Auditoria básica.

### Não implementar

- OAuth.
- Google Login.
- GitHub Login.
- MFA.
- Permissões granulares.
- Convites.
- Refresh token JWT.

### Critérios de aceite

- Usuário não autenticado não acessa o painel.
- Sessão pode ser revogada.
- Organização A não acessa dados da organização B.
- Recuperação de senha funciona via Mailpit.

---

## Fase 4 — Configuração do estabelecimento

### Campos

- Nome público.
- Descrição.
- Telefone.
- WhatsApp.
- Endereço.
- Horários.
- Logo.
- Imagem de capa.
- Cor principal.
- Tema.
- Slug.

### Implementações

- Tela de configuração.
- Validação de slug.
- Pré-visualização.
- Upload de logo.
- Upload de capa.
- Endpoint público.

### Critério de aceite

As configurações publicadas aparecem no cardápio.

---

## Fase 5 — Gestão de categorias

### Implementações

- Criar categoria.
- Editar categoria.
- Arquivar categoria.
- Ativar categoria.
- Desativar categoria.
- Reordenar categoria.
- Validar duplicidade.
- Listar por estado.
- Testes de integração.

### Critério de aceite

O administrador consegue gerenciar categorias sem alterar o banco manualmente.

---

## Fase 6 — Gestão de produtos

### Implementações

- Criar produto.
- Editar produto.
- Salvar como rascunho.
- Arquivar produto.
- Definir categoria.
- Definir preço.
- Definir preço promocional.
- Descrição curta.
- Descrição completa.
- Ingredientes.
- Alergênicos.
- Porção.
- Disponibilidade.
- Destaque.
- Ordenação.
- Validação de preço.
- Validação de estado.
- Filtros administrativos.

### Critério de aceite

O administrador consegue criar um catálogo completo sem mídias.

---

## Fase 7 — Gestão de mídias

### Implementações

- Criar `StorageService`.
- Criar `MinioStorageService`.
- Upload de imagens.
- Upload de vídeos.
- Validação MIME.
- Validação de tamanho.
- Nome interno aleatório.
- Remoção.
- Mídia principal.
- Reordenação.
- Preview.
- Fallback.
- Limpeza de arquivos órfãos.

### Critério de aceite

Imagens e vídeos ficam armazenados no MinIO e aparecem corretamente no painel.

---

## Fase 8 — Publicação do cardápio

### Implementações

- Estado de rascunho.
- Validação antes da publicação.
- Criação de snapshot.
- Versionamento.
- Publicação.
- Consulta da versão publicada.
- Preparação para rollback futuro.

### Critério de aceite

Alterações administrativas somente aparecem no cardápio depois da publicação.

---

## Fase 9 — Feed público

### Etapa 9.1 — Estrutura básica

- Rota pública.
- Dados do estabelecimento.
- Produtos publicados.
- Categorias.
- Loading.
- Erros.
- Estados vazios.

### Etapa 9.2 — Feed vertical

- Produto principal por viewport.
- Scroll snapping.
- Navegação vertical.
- Preservação de posição.
- Pré-carregamento.
- Virtualização ou descarte de conteúdo distante.

### Etapa 9.3 — Galeria horizontal

- Swipe horizontal.
- Indicador de posição.
- Fotos.
- Vídeos.
- Conflito entre gestos.

### Etapa 9.4 — Vídeo

- Reprodução automática sem áudio.
- Um vídeo ativo.
- Pausa fora da viewport.
- Poster.
- Controle de áudio.
- Redução de movimento.

### Etapa 9.5 — Categorias

- Barra horizontal.
- Categoria ativa.
- Filtro sem reload.
- Opção todos.

### Etapa 9.6 — Detalhes

Recomendação:

> Abrir os detalhes como bottom sheet no mobile.

Informações:

- Nome.
- Descrição.
- Preço.
- Ingredientes.
- Alergênicos.
- Porção.
- Galeria.
- Contatos.

### Critério de aceite

- Feed funciona por toque e scroll.
- Não existem dois vídeos reproduzindo.
- Próximo produto é pré-carregado.
- Elementos distantes não permanecem pesados.
- Funciona em mobile.
- Funciona por teclado no desktop.

---

## Fase 10 — Analytics básico

### Implementações

- SDK interno no frontend.
- Endpoint de ingestão.
- Envio em lote.
- `eventId`.
- Idempotência.
- Validação.
- Deduplicação.
- Sessão anônima.
- `sendBeacon`.
- Marcação de tráfego interno.
- Testes temporais.

### Critério de aceite

Passar rapidamente por um produto não gera visualização qualificada.

---

## Fase 11 — Dashboard

### Métricas iniciais

- Total de sessões.
- Total de impressões.
- Total de visualizações qualificadas.
- Total de cliques.
- Produtos mais visualizados.
- Produtos com mais detalhes abertos.
- Categorias mais acessadas.
- Evolução diária.
- Filtro de 7 dias.
- Filtro de 30 dias.

### Tabelas sugeridas

```text
DailyEstablishmentMetric
DailyProductMetric
DailyCategoryMetric
```

### Agregação inicial

Pode ser realizada por:

- Comando manual.
- Cron simples.
- Consulta SQL.
- Processo síncrono enquanto o volume for pequeno.

### Critério de aceite

Os números do dashboard devem ser reproduzíveis a partir dos eventos brutos.

---

## Fase 12 — QR Code e refinamento

### Implementações

- QR Code geral.
- Download PNG.
- Download SVG.
- Link público.
- Compartilhamento.
- Open Graph.
- Página 404.
- Cardápio não publicado.
- Estado suspenso.
- Empty states.
- Skeletons.
- Fallbacks.
- Acessibilidade.
- Desktop responsivo.
- Tema claro.
- Tema escuro.
- Dados demonstrativos.

### Critério final do MVP

O sistema deverá permitir:

```text
1. Administrador entra no painel
2. Cria categoria
3. Cadastra produto
4. Envia foto e vídeo
5. Define preço e disponibilidade
6. Publica o cardápio
7. Abre pelo QR Code
8. Navega pelo feed
9. Abre detalhes
10. Realiza interações
11. Volta ao painel
12. Visualiza as métricas
```

---

# CICLO 2 — Evolução para SaaS demonstrável

## Fase 13 — Usuários, convites e papéis

### Implementações

- Convite por e-mail.
- Proprietário.
- Administrador.
- Editor.
- Analista.
- Matriz de permissões.
- Gerenciamento de membros.
- Remoção de acesso.
- Auditoria administrativa.

---

## Fase 14 — Planos e limites simulados

### Entidades

```text
Plan
PlanFeature
Subscription
UsageRecord
Entitlement
```

### Planos locais

```text
BASIC
PROFESSIONAL
PREMIUM
```

### Limites simulados

- Produtos.
- Imagens.
- Vídeos.
- Usuários.
- Estabelecimentos.
- Armazenamento.

### Regra de implementação

Evitar:

```ts
if (plan === 'PREMIUM')
```

Utilizar:

```ts
entitlements.canUploadVideo;
entitlements.maxProducts;
entitlements.maxMembers;
```

O sistema deverá consultar capacidades, não nomes fixos de planos.

---

## Fase 15 — Painel administrativo da plataforma

### Implementações

- Organizações.
- Estabelecimentos.
- Usuários.
- Planos.
- Assinaturas simuladas.
- Uso de armazenamento.
- Produtos publicados.
- Eventos.
- Suspensão de conta.
- Alteração manual de plano.

---

## Fase 16 — Cardápio tradicional e busca

### Implementações

- Visualização em lista.
- Alternância feed/lista.
- Busca por nome.
- Busca por descrição.
- Busca por ingrediente.
- Preservação da categoria.
- Analytics de troca de modo.

---

## Fase 17 — Recursos avançados de catálogo

- Produtos relacionados.
- Menus por horário.
- Menus sazonais.
- Agendamento de publicação.
- Promoções com data.
- Duplicação de produto.
- Duplicação de menu.
- Rollback.
- Importação CSV.
- Exportação do catálogo.

---

## Fase 18 — Processamento assíncrono

### Tecnologias

- Redis.
- BullMQ.
- Worker.
- FFmpeg.

### Funcionalidades

- Conversão de vídeos.
- Geração de thumbnails.
- Otimização de imagens.
- Limpeza de arquivos.
- Agregação de analytics.
- Retentativas.
- Dead-letter handling.

### Estrutura futura

```text
apps/
├── web
├── api
└── worker
```

---

# CICLO 3 — Preparação para produção real

## Fase 19 — Substituição dos serviços locais

| Ambiente local   | Produção                      |
| ---------------- | ----------------------------- |
| MinIO            | Cloudflare R2                 |
| MP4 direto       | Cloudflare Stream             |
| Mailpit          | Resend ou SMTP                |
| PostgreSQL local | PostgreSQL gerenciado         |
| Redis local      | Redis gerenciado              |
| URL local        | Domínio real                  |
| Logs locais      | Plataforma de observabilidade |

As mudanças deverão ocorrer principalmente em adaptadores de infraestrutura.

---

## Fase 20 — Cobrança real

### Implementações

- Stripe.
- Checkout.
- Webhooks.
- Idempotência.
- Histórico de cobrança.
- Trial.
- Upgrade.
- Downgrade.
- Cancelamento.
- Período de tolerância.
- Portal do cliente.
- Reconciliação de assinatura.
- Testes de webhooks.

---

## Fase 21 — Hardening de produção

- CDN.
- Cache.
- Rate limit distribuído.
- URLs assinadas.
- Upload direto.
- Backups.
- Restauração.
- Segredos gerenciados.
- Auditoria completa.
- Monitoramento.
- Alertas.
- Política de retenção.
- LGPD.
- Testes de carga.
- Testes de recuperação.
- Domínios personalizados.
- Suspensão de conta.
- Tratamento de indisponibilidade.

---

# 18. Ordem resumida de implementação

```text
0. Fonte da verdade
1. Fundação técnica
2. Domínio e banco
3. Autenticação e isolamento
4. Configuração do estabelecimento
5. Categorias
6. Produtos
7. Mídias
8. Publicação
9. Feed público
10. Analytics
11. Dashboard
12. QR Code e refinamento
-----------------------------
MVP DE PORTFÓLIO CONCLUÍDO
-----------------------------
13. Usuários e permissões
14. Planos simulados
15. Painel da plataforma
16. Cardápio tradicional e busca
17. Catálogo avançado
18. Redis, filas e worker
-----------------------------
SAAS DEMONSTRÁVEL CONCLUÍDO
-----------------------------
19. Serviços externos
20. Stripe
21. Hardening de produção
```

---

# 19. Estratégia de desenvolvimento

## 19.1 Trabalhar por fluxo vertical

Não construir primeiro todo o backend e depois todo o frontend.

Cada fase deve entregar um fluxo funcional completo.

Exemplo:

```text
Migration
→ Service
→ Controller
→ OpenAPI
→ Tela
→ Validação
→ Testes
```

---

## 19.2 Critério de conclusão de uma fase

Uma fase somente será considerada concluída quando possuir:

- Código funcional.
- Validação.
- Tratamento de erros.
- Autorização.
- Testes importantes.
- Documentação da API.
- Interface utilizável.
- Critérios de aceite validados.
- Ausência de regressões conhecidas.

---

## 19.3 Estratégia de branches

Para projeto individual:

```text
main
feature/foundation
feature/authentication
feature/categories
feature/products
feature/media
feature/public-feed
feature/analytics
feature/dashboard
```

Não utilizar Git Flow completo.

Criar branches curtas e integrá-las após validação.

---

# 20. Prioridade real

A ordem de prioridade será:

1. Fundação arquitetural mínima.
2. Catálogo administrável.
3. Publicação consistente.
4. Feed com boa performance.
5. Analytics confiável.
6. Dashboard.
7. Recursos de SaaS.

Não iniciar por:

- Stripe.
- Painel da plataforma.
- Permissões avançadas.
- Microserviços.
- Redis.
- Filas.
- FFmpeg.
- Dashboard excessivamente sofisticado.

---

# 21. Riscos principais

## 21.1 Escopo excessivo

### Risco

Transformar o projeto de portfólio em um SaaS completo antes de finalizar o diferencial principal.

### Mitigação

- Seguir as fases.
- Congelar o escopo do MVP.
- Adicionar novas funcionalidades somente depois da Fase 12.

---

## 21.2 Complexidade de mídia

### Risco

Vídeos e imagens causarem lentidão, consumo de memória e erros.

### Mitigação

- Limites de tamanho.
- Limites de duração.
- Um vídeo ativo por vez.
- Pré-carregamento controlado.
- Fallbacks.
- Poucos elementos renderizados.

---

## 21.3 Analytics incorreto

### Risco

Dashboard mostrar métricas inconsistentes.

### Mitigação

- Definições formais.
- Eventos idempotentes.
- Deduplicação.
- Eventos brutos preservados.
- Agregações reproduzíveis.
- Testes temporais.

---

## 21.4 Vazamento entre tenants

### Risco

Um estabelecimento acessar dados de outro.

### Mitigação

- Contexto de organização.
- Filtros obrigatórios.
- Guards.
- Testes de isolamento.
- Auditoria.

---

## 21.5 Acoplamento a serviços locais

### Risco

Ficar preso ao MinIO ou a soluções locais.

### Mitigação

- Interfaces.
- Adaptadores.
- Inversão de dependência.
- Configuração por ambiente.

---

# 22. Recomendação final

O primeiro grande marco do projeto será:

> Um administrador entra no painel, cadastra produtos com mídia, publica o cardápio, navega pelo feed por QR Code e consulta as métricas das interações.

Quando esse fluxo estiver:

- Completo.
- Testado.
- Documentado.
- Visualmente apresentável.
- Executável por Docker Compose.

O MVP de portfólio estará concluído.

A partir desse ponto, os recursos de SaaS poderão ser adicionados de forma incremental sem comprometer a conclusão do produto principal.
