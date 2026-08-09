# API

A API REST usa NestJS e OpenAPI. O contrato inicial contém apenas endpoints técnicos; endpoints de
identidade, catálogo e menu público serão adicionados com suas respectivas fases verticais.

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
