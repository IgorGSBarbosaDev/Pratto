# Fundação técnica

## Execução

1. Copiar `.env.example` para `.env`.
2. Instalar Node.js, pnpm e Docker Compose.
3. Executar `pnpm install`.
4. Executar `docker compose up -d`.
5. Executar `pnpm dev`.

## Endpoints técnicos

- `GET /health`: estado da API e das dependências PostgreSQL, MinIO e Mailpit.
- `GET /docs`: documentação OpenAPI da API.

O health check retorna `ok` quando todas as dependências respondem e `degraded` quando uma ou mais
dependências não estão disponíveis. Mensagens de dependência são diagnósticas e não substituem o
tratamento de erros da aplicação.

## Configuração

A configuração é validada na inicialização por `@pratto/config`. A aplicação deve falhar cedo
quando uma variável obrigatória estiver ausente, inválida ou insegura. Segredos não devem ser
versionados.
