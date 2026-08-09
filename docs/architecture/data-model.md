# Modelo de dados multi-tenant inicial

## Relações

```text
User 1 ── * Session
User 1 ── 1 PasswordCredential
User 1 ── 0..1 PasswordResetToken
User 1 ── * Membership * ── 1 Organization
Organization 1 ── * Establishment
Establishment 1 ── * Menu
Menu 1 ── * Category
Menu 1 ── * Product
Category 1 ── * Product
Product 1 ── * ProductMedia
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

`Establishment` também mantém a descrição, telefone, WhatsApp, endereço estruturado, horários de
funcionamento e configurações básicas de tema em JSONB validado no limite da API. Logo e capa são
referências compostas por chave e tipo MIME, armazenadas no próprio estabelecimento e materializadas
como URL pelo `StorageService`.

`ProductMedia` mantém a chave privada do objeto, tipo MIME, nome original, tamanho, ordem e mídia
principal. A administração recebe somente URLs de leitura assinadas e temporárias. Snapshots de
publicação guardam a `storageKey`, preservando a referência histórica sem congelar uma URL que
expiraria.

## Isolamento e integridade

`Menu` mantém `organizationId` e `establishmentId`. A FK composta referencia
`Establishment(id, organizationId)`, impedindo que um menu seja gravado com o tenant de outro
estabelecimento. `Category` repete `organizationId` e usa FK composta para o menu. `Product` repete
o tenant e o menu, mantém uma categoria obrigatória e usa FKs compostas para impedir associação
entre menus ou tenants diferentes. O nome normalizado é único entre categorias não arquivadas do
mesmo menu. `MenuPublication` repete `organizationId` e usa FKs compostas para o menu e para
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
- `Category`: `ACTIVE` ou `INACTIVE`; o arquivamento preenche `archivedAt` e mantém o registro.
- `Product`: `ACTIVE` ou `INACTIVE`, com `AVAILABLE`, `TEMPORARILY_UNAVAILABLE` ou `HIDDEN` para
  disponibilidade; o arquivamento preenche `archivedAt` e mantém o registro.
- `Product.price` e `Product.promotionalPrice` usam `DECIMAL(10,2)`; a API não aceita números
  JavaScript para evitar conversões por ponto flutuante.
- `ProductMedia` mantém o tenant e o menu repetidos e referencia o produto por uma FK composta
  `(product_id, organization_id, menu_id)`. Cada item guarda tipo, MIME, nome original, chave
  aleatória do MinIO, tamanho, ordem e indicação de mídia principal. Um índice único parcial impede
  mais de uma mídia principal por produto; a API promove a primeira mídia restante ao remover a
  principal.

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
