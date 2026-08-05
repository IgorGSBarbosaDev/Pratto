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
