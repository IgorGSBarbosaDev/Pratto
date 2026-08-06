# Arquitetura atual

O Pratto é um monólito modular em um monorepo. A aplicação é dividida em uma API NestJS e uma
aplicação Next.js, com pacotes compartilhados para contratos, validação, interface, configuração e
persistência.

## Limites

- Controllers e componentes de interface lidam somente com transporte e apresentação.
- Regras de negócio pertencem aos módulos de domínio.
- Prisma, MinIO e Mailpit são adapters de infraestrutura.
- Contratos compartilhados não expõem entidades Prisma.
- O contexto de tenant é derivado da sessão e revalidado contra memberships ativas.

## Módulos previstos da API

`identity`, `organizations`, `establishments`, `catalog`, `media`, `public-menu`, `analytics` e
`audit`. Nesta fase, `identity` e `organizations` implementam autenticação e resolução do tenant;
os demais módulos permanecem incrementais.

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
[`data-model.md`](./data-model.md). A estratégia de sessão, CSRF, recuperação e tenant está em
[`authentication.md`](./authentication.md).
