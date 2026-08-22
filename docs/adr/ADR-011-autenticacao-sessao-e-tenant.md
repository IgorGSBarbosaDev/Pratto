# ADR-011 — Sessão administrativa e seleção de tenant

- Status: aceito
- Data: 2026-08-05

## Contexto

Usuários podem participar de várias organizações. O sistema precisa manter sessões revogáveis,
proteger mutações contra CSRF, tolerar retries e impedir que IDs fornecidos pelo cliente definam o
tenant. Rate limit em memória não funciona de forma consistente com múltiplas instâncias futuras.

## Decisão

Usar tokens opacos em cookie e somente seu HMAC no PostgreSQL. Sessões têm sete dias absolutos, 24
horas de inatividade e renovação limitada a 15 minutos. A seleção atual é o `activeMembershipId` da
sessão, protegido por FK composta com `userId`; uma membership ativa é automática e múltiplas
exigem seleção explícita.

Usar prova CSRF assinada, vinculada à sessão e repetida de cookie para header. Derivar chaves HMAC
por finalidade via HKDF. Manter rate limits em buckets PostgreSQL atômicos e persistir eventos de
autenticação sem valores sensíveis em claro.

## Consequências

- Revogação, renovação e seleção sobrevivem a reinícios e múltiplas instâncias.
- Toda rota tenant-aware precisa dos guards de autenticação e organização.
- Uma consulta adicional revalida relações ativas, priorizando isolamento sobre cache prematuro.
- A seleção por estabelecimento continua fora do escopo; permissões granulares de equipe foram
  adicionadas em `ADR-012` sem alterar o mecanismo de seleção de organização.
