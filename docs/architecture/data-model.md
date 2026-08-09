# Modelo de dados multi-tenant inicial

## Relações

```text
User 1 ── * Session
User 1 ── 1 PasswordCredential
User 1 ── 0..1 PasswordResetToken
User 1 ── * Membership * ── 1 Organization
Organization 1 ── * Establishment
Establishment 1 ── * Menu
Menu 1 ── * MenuPublication
Menu 1 ── 0..1 MenuPublication (active)
```

`Membership` é a única ligação de autorização entre usuário e organização. Não existe relação
direta entre usuário e estabelecimento. Um usuário pode participar de várias organizações, e cada
organização pode possuir vários estabelecimentos.

## Identificadores e exposição pública

Todas as entidades usam UUIDs internos gerados pelo PostgreSQL. Somente `Establishment` recebe
`publicId`, pois a URL e o QR Code identificam o estabelecimento independentemente do menu ativo.
O `publicId` é globalmente único e imutável no banco. O `slug` é mutável, validado e único somente
dentro da organização; ele não é usado como chave estrangeira nem identidade permanente.

## Isolamento e integridade

`Menu` mantém `organizationId` e `establishmentId`. A FK composta referencia
`Establishment(id, organizationId)`, impedindo que um menu seja gravado com o tenant de outro
estabelecimento. `MenuPublication` repete `organizationId` e usa FKs compostas para o menu e para
a membership do publisher. Consultas administrativas filtram explicitamente pelo contexto de
organização derivado da sessão. A FK composta da seleção ativa também garante que a membership
pertença ao usuário da sessão.

As constraints também garantem e-mails normalizados, textos obrigatórios não vazios, slugs em
formato canônico, coerência temporal das sessões e unicidades de memberships e identificadores.
Publicações têm versão e chave de idempotência únicas por menu, guardam snapshot como objeto JSONB
e são append-only por trigger. O menu só pode apontar para uma publicação do mesmo menu e tenant.
Organizações com estabelecimentos e estabelecimentos com menus não podem ser excluídos por
cascade. Sessões, memberships e publicações preservam as referências necessárias ao histórico.

## Estados

- `LifecycleStatus`: `ACTIVE`, `INACTIVE`.
- `MembershipRole`: `OWNER`, `ADMIN`, `MEMBER`.
- `MenuStatus`: `DRAFT`, `ACTIVE`, `ARCHIVED`.

Sessões derivam validade de `expiresAt` (inatividade), `absoluteExpiresAt` e `revokedAt`, sem estado
duplicado. Credenciais, tokens de recuperação, buckets de limite e eventos de autenticação são
tabelas técnicas sem expor valores sensíveis em claro.

## Desenvolvimento e testes

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm test
```

O seed lê `SEED_ADMIN_PASSWORD`, usa chaves determinísticas e não sobrescreve uma credencial já
existente. Os testes de integração usam `.env.test` e recriam apenas o schema `pratto_test`.
