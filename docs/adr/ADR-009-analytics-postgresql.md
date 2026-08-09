# ADR-009 — Analytics próprio no PostgreSQL

**Status:** aceito

Eventos anônimos serão validados, deduplicados por identificador e armazenados no PostgreSQL antes
de qualquer agregação de dashboard.

## Decisões da Etapa 9

- `AnalyticsSession` é uma sessão anônima por estabelecimento, criada sem login e expirada após 30
  minutos de inatividade. O frontend guarda somente o UUID retornado no `localStorage` daquele
  estabelecimento.
- `AnalyticsEvent` repete organização, estabelecimento, menu, publicação e sessão. FKs compostas
  impedem combinações entre tenants, menus, publicações e alvos distintos.
- O `publicationId` é exposto no retorno público do menu para preservar a atribuição à versão
  imutável que o visitante realmente carregou.
- `eventId` garante idempotência. Impressões, visualizações qualificadas, categorias e abertura do
  menu usam também uma chave semântica única por sessão/publicação/alvo; interações contam por
  `eventId`.
- O endpoint aceita lotes limitados e retorna resultado individual por evento. O SDK usa fila,
  `sendBeacon` e falhas silenciosas para manter o feed independente do analytics.
- Rate limits usam somente hashes keyed de rastreadores temporários; IP, user-agent e dados pessoais
  não são persistidos.
- A retenção operacional é deliberadamente curta e fixa no MVP: sessões expiradas há mais de 7 dias
  são removidas apenas quando não possuem eventos vinculados; buckets de rate limit sem atualização
  há 2 horas são removidos.
- A limpeza roda a cada hora, em lotes de 500 com `SKIP LOCKED`. Execuções sobrepostas no mesmo
  processo são coalescidas e eventos nunca são apagados; sessões referenciadas por eventos são
  preservadas para manter as consultas históricas e futuras agregações reproduzíveis.
