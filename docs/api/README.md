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
