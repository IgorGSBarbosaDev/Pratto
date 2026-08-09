# API

A API REST usa NestJS e OpenAPI. O contrato evolui por fatias verticais e documenta endpoints
administrativos, públicos e técnicos conforme cada módulo é entregue.

## Erros

Erros HTTP usam o formato:

```json
{
  "statusCode": 400,
  "code": "REQUEST_ERROR",
  "message": "Request is invalid",
  "requestId": "uuid"
}
```

Stack traces, cookies, tokens e segredos nunca são enviados ao cliente.

# API REST

Swagger fica disponível em `http://localhost:4000/docs`. A autenticação usa o cookie opaco
`pratto_session`; corpos nunca retornam hashes, tokens ou dados internos de persistência.

## Autenticação

| Método | Rota                        | Resultado                                                    |
| ------ | --------------------------- | ------------------------------------------------------------ |
| POST   | `/auth/login`               | Cria sessão e retorna contexto seguro.                       |
| POST   | `/auth/logout`              | Revoga a sessão, limpa cookies e retorna 204.                |
| POST   | `/auth/logout-all`          | Revoga todas as sessões e retorna 204.                       |
| GET    | `/auth/me`                  | Retorna usuário, organizações e estabelecimentos acessíveis. |
| POST   | `/auth/select-organization` | Persiste uma membership ativa da própria pessoa.             |
| GET    | `/auth/csrf`                | Reemite a prova CSRF da sessão.                              |
| POST   | `/auth/forgot-password`     | Sempre retorna 202 com mensagem neutra.                      |
| POST   | `/auth/reset-password`      | Consome o token, altera senha e retorna 204.                 |

Mutações autenticadas exigem `X-CSRF-Token` com o mesmo valor de `pratto_csrf`. Erros seguem
`{ statusCode, code, message, requestId?, details? }` e preservam códigos estáveis documentados em
[`authentication.md`](../architecture/authentication.md).

## Configuração do estabelecimento

As rotas administrativas abaixo exigem sessão autenticada, organização ativa e prova CSRF nas
mutações. O `establishmentId` é sempre combinado com o `organizationId` resolvido pela sessão; ele
nunca troca o tenant informado pelos guards.

| Método | Rota                                                       | Resultado                                                        |
| ------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/admin/establishments/:establishmentId/settings`          | Consulta os dados públicos do estabelecimento.                   |
| PATCH  | `/admin/establishments/:establishmentId/settings`          | Atualiza nome, slug, contatos, endereço, horários e tema.        |
| POST   | `/admin/establishments/:establishmentId/assets/:assetKind` | Substitui logo ou capa com imagem JPEG, PNG ou WebP de até 5 MB. |
| DELETE | `/admin/establishments/:establishmentId/assets/:assetKind` | Remove a referência de logo ou capa.                             |

`assetKind` aceita `logo` ou `cover`. Logo e capa são referências de asset do estabelecimento e
usam o `StorageService` existente.

## Categorias do cardápio

As rotas de categoria exigem sessão autenticada, organização ativa e prova CSRF nas mutações.
O menu é sempre consultado junto do `organizationId` resolvido pela sessão. A tela administrativa
lista os menus editáveis e exige que o usuário selecione explicitamente o `menuId` alvo antes de
carregar ou alterar categorias.

| Método | Rota                                                     | Resultado                                         |
| ------ | -------------------------------------------------------- | ------------------------------------------------- |
| GET    | `/admin/establishments/:establishmentId/menus`           | Lista menus editáveis disponíveis para seleção.   |
| GET    | `/admin/menus/:menuId/categories`                        | Lista categorias de um menu do tenant.            |
| POST   | `/admin/menus/:menuId/categories`                        | Cria categoria ao final da ordem.                 |
| PATCH  | `/admin/menus/:menuId/categories/:categoryId`            | Edita nome e descrição.                           |
| POST   | `/admin/menus/:menuId/categories/:categoryId/activate`   | Ativa categoria.                                  |
| POST   | `/admin/menus/:menuId/categories/:categoryId/deactivate` | Desativa categoria.                               |
| POST   | `/admin/menus/:menuId/categories/:categoryId/archive`    | Arquiva sem exclusão destrutiva.                  |
| PATCH  | `/admin/menus/:menuId/categories/reorder`                | Recebe todos os IDs não arquivados na nova ordem. |

Categorias arquivadas permanecem na listagem para preservar histórico e não podem ser alteradas.
Snapshots já publicados permanecem imutáveis; somente uma nova publicação lê as categorias ativas
do catálogo editável.

## Produtos do cardápio

As rotas de produto usam o mesmo menu alvo explícito, sessão autenticada, organização ativa e
CSRF nas mutações. Cada produto pertence ao menu e a uma categoria não arquivada do mesmo tenant;
o preço e o preço promocional são strings decimais na API e `DECIMAL(10,2)` no PostgreSQL.

| Método | Rota                                                  | Resultado                                                    |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------ |
| GET    | `/admin/menus/:menuId/products`                       | Lista produtos do menu, incluindo arquivados para histórico. |
| POST   | `/admin/menus/:menuId/products`                       | Cria produto ao final da ordem.                              |
| PATCH  | `/admin/menus/:menuId/products/:productId`            | Edita dados, categoria, preços e disponibilidade.            |
| POST   | `/admin/menus/:menuId/products/:productId/activate`   | Ativa produto.                                               |
| POST   | `/admin/menus/:menuId/products/:productId/deactivate` | Desativa produto.                                            |
| POST   | `/admin/menus/:menuId/products/:productId/archive`    | Arquiva sem exclusão destrutiva.                             |
| PATCH  | `/admin/menus/:menuId/products/reorder`               | Recebe todos os IDs não arquivados na nova ordem.            |

Produtos arquivados permanecem no catálogo editável e não podem ser alterados. A publicação inclui
produtos ativos e não arquivados associados a categorias ativas; publicações anteriores não são
reescritas.

## Mídias dos produtos

As rotas de mídia exigem sessão autenticada, organização ativa e CSRF nas mutações. A API valida
MIME, extensão, assinatura básica do conteúdo e tamanho antes de gravar no MinIO. Imagens JPEG,
PNG e WebP têm limite de 5 MB; vídeos MP4, WebM e MOV têm limite de 50 MB.

| Método | Rota                                                              | Resultado                                |
| ------ | ----------------------------------------------------------------- | ---------------------------------------- |
| GET    | `/admin/menus/:menuId/products/:productId/media`                  | Lista as mídias do produto no tenant.    |
| POST   | `/admin/menus/:menuId/products/:productId/media`                  | Faz upload multipart no campo `file`.    |
| POST   | `/admin/menus/:menuId/products/:productId/media/:mediaId/primary` | Define a mídia principal.                |
| PATCH  | `/admin/menus/:menuId/products/:productId/media/reorder`          | Recebe todos os IDs na nova ordem.       |
| DELETE | `/admin/menus/:menuId/products/:productId/media/:mediaId`         | Remove a referência e o objeto do MinIO. |

As chaves de armazenamento são aleatórias e escopadas por organização, menu e produto. Todas as
consultas administrativas combinam esses três escopos; mídias de produtos arquivados não podem ser
gerenciadas. O primeiro upload torna-se principal, e a remoção da principal promove a primeira
mídia restante. O bucket MinIO permanece privado e o GET devolve URL de preview assinada e
temporária.

Uma nova publicação usa `schemaVersion: 3` e inclui a lista de mídias dos produtos ativos no
snapshot usando `storageKey`, sem congelar uma URL assinada expirável. Publicações anteriores
continuam imutáveis; o feed público permanece fora desta etapa.

## Publicação administrativa

As rotas abaixo usam o `menuId` explícito, a organização resolvida pela sessão e exigem CSRF na
publicação. A publicação aceita a chave `Idempotency-Key` (1 a 128 caracteres); repetir a mesma
chave devolve a mesma versão sem criar outra publicação.

| Método | Rota                                | Resultado                                                        |
| ------ | ----------------------------------- | ---------------------------------------------------------------- |
| POST   | `/admin/menus/:menuId/publications` | Cria e ativa atomicamente um novo snapshot.                      |
| GET    | `/admin/menus/:menuId/publication`  | Consulta a publicação ativa, incluindo o snapshot.               |
| GET    | `/admin/menus/:menuId/publications` | Lista até 100 versões históricas, da mais recente à mais antiga. |

O snapshot administrativo usa `schemaVersion: 3` e congela estabelecimento, menu, categorias,
produtos e mídias. Referências de mídia usam `storageKey`, nunca URL assinada temporária. A troca
da publicação ativa e a criação da versão acontecem na mesma transação serializável; falhas
descartam o snapshot e a ativação. Rollback ainda não é exposto.

## Cardápio público

A rota pública não exige sessão, organização ativa ou CSRF. Ela consulta exclusivamente o menu e a
`MenuPublication` apontada por `activePublicationId`; nunca lê produtos, categorias ou mídias do
catálogo editável.

| Método | Rota                                    | Resultado                            |
| ------ | --------------------------------------- | ------------------------------------ |
| GET    | `/public/establishments/:publicId/menu` | Página paginada da publicação ativa. |

Os parâmetros opcionais são `cursor`, `categoryId` e `limit` (6 por padrão, máximo 12). O cursor é
opaco e vinculado à publicação ativa. Produtos `HIDDEN` não são retornados; produtos
`TEMPORARILY_UNAVAILABLE` permanecem visíveis com sua indisponibilidade. O retorno materializa URLs
assinadas temporárias para as mídias solicitadas, sem expor `storageKey`, `publishedBy` ou metadados
administrativos.

O endereço amigável do frontend é `/menu/{publicId}/{slug}`. O `publicId` é a identidade estável e
o slug é canônico apenas para apresentação. Se houver mais de um menu publicado para o mesmo
estabelecimento, a API retorna `PUBLIC_MENU_CONFIGURATION_INVALID` em vez de escolher um menu
implicitamente.

## Analytics público

Analytics não exige login e não participa do carregamento do feed. O retorno do cardápio inclui
`menu.publicationId`, usado pelo cliente para atribuir cada evento à publicação imutável correta.

| Método | Rota                         | Resultado                                                 |
| ------ | ---------------------------- | --------------------------------------------------------- |
| POST   | `/public/analytics/sessions` | Cria ou retoma uma sessão anônima do estabelecimento.     |
| POST   | `/public/analytics/events`   | Ingere até 50 eventos e retorna o resultado de cada item. |

Os eventos aceitos são `menu_opened`, `product_impression`, `product_viewed`,
`product_interaction` e `category_selected`. Uma impressão exige 50% da viewport por 500 ms;
uma visualização qualificada exige 70% por 2 segundos. Sessões expiram após 30 minutos sem
atividade. Timestamps devem estar entre 15 minutos no passado e 2 minutos no futuro.

O servidor valida publicação, sessão, produto e categoria contra o snapshot e o estabelecimento
resolvido pelo `publicId`. Repetições de `eventId` são idempotentes; impressões, visualizações,
categorias e abertura do menu também são deduplicadas por sessão/publicação/alvo. O lote pode ter
sucessos e rejeições simultaneamente. Rate limits são persistidos com hashes keyed e nenhum IP,
user-agent ou dado pessoal é armazenado.

A limpeza operacional roda a cada hora em lotes de até 500 registros. Sessões expiradas há mais de
7 dias são removidas somente quando não possuem eventos vinculados; sessões referenciadas por
eventos permanecem para preservar o histórico. Buckets de rate limit sem atualização há 2 horas
são removidos. A limpeza usa `SKIP LOCKED`, evita execução concorrente no mesmo processo e nunca
remove registros de `analytics_events`.
