# Arquitetura atual

O Pratto é um monólito modular em um monorepo. A aplicação é dividida em uma API NestJS e uma
aplicação Next.js, com pacotes compartilhados para contratos, validação, interface, configuração e
persistência.

## Limites

- Controllers e componentes de interface lidam somente com transporte e apresentação.
- Regras de negócio pertencem aos módulos de domínio.
- Prisma, MinIO e Mailpit são adapters de infraestrutura.
- Contratos compartilhados não expõem entidades Prisma.
- O contexto de tenant será derivado da sessão autenticada nas fases de domínio e autenticação.

## Módulos previstos da API

`identity`, `organizations`, `establishments`, `catalog`, `media`, `public-menu`, `analytics` e
`audit`. A fundação cria apenas os módulos técnicos necessários para executar e observar a API.

## Dependências locais

```text
Web ───────► API ───────► PostgreSQL
                         ├── MinIO
                         └── Mailpit
```

Os adapters de storage e e-mail são acessados por interfaces. Isso permite substituir MinIO e
Mailpit sem alterar as regras de negócio.

## Persistência do domínio

O primeiro schema multi-tenant e suas regras de integridade estão descritos em
[`data-model.md`](./data-model.md). Ele cobre usuários, sessões, organizações, memberships,
estabelecimentos e menus, sem antecipar autenticação ou catálogo.
