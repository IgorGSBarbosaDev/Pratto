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
usam o `StorageService` existente; não há ainda entidade ou fluxo de mídia de produtos.

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
