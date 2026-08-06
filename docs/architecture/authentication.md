# Autenticação administrativa

## Credenciais e tokens

Senhas são armazenadas exclusivamente em `PasswordCredential`, uma relação 1:1 com `User`, usando
Argon2id (19 MiB, duas iterações e paralelismo 1). A aplicação aceita de 15 a 128 caracteres Unicode
e não altera espaços nem exige regras artificiais de composição.

Tokens de sessão e recuperação têm 32 bytes aleatórios. O valor bruto só é entregue ao cliente; o
PostgreSQL recebe HMAC-SHA-256. Chaves independentes para sessão, recuperação, rate limit e CSRF são
derivadas de `COOKIE_SECRET` por HKDF.

## Sessões e CSRF

A sessão tem limite absoluto de sete dias, limite ocioso de 24 horas e é renovada no máximo a cada
15 minutos, sem criar um novo registro. `pratto_session` contém somente o token opaco e usa
`HttpOnly`, `SameSite=Lax`, `Path=/`, nenhum `Domain` e `Secure` conforme `COOKIE_SECURE`.

Mutações autenticadas exigem que `pratto_csrf`, legível pelo frontend, seja repetido em
`X-CSRF-Token`. A prova é assinada e vinculada ao UUID interno da sessão. Login, logout, solicitação
e consumo de recuperação também validam estritamente `Origin` ou `Referer`. Respostas de
autenticação usam `Cache-Control: no-store`.

## Contexto multi-tenant

`Membership` continua sendo a fonte exclusiva de autorização. Uma única membership ativa é
selecionada automaticamente; com várias, a sessão permanece autenticada sem tenant até
`POST /auth/select-organization`. A FK composta `(activeMembershipId, userId)` impede seleção de uma
membership alheia no próprio banco.

Em toda resolução tenant-aware, o guard revalida usuário, membership, organização e
estabelecimentos ativos. IDs enviados pelo cliente nunca substituem o contexto resolvido. OWNER,
ADMIN e MEMBER têm o mesmo acesso nesta fase.

## Recuperação, limite e auditoria

Há no máximo um `PasswordResetToken` por usuário. Um novo pedido o substitui; o consumo usa update
condicional e, na mesma transação, altera a credencial e revoga todas as sessões. O link usa o
fragmento `#token=`, que o frontend move para memória e remove imediatamente da URL.

`AuthRateLimitBucket` mantém contadores atômicos e persistentes com trackers protegidos por HMAC.
Login limita 5/e-mail e 30/IP em 15 minutos; recuperação, 3/e-mail e 20/IP por hora; reset, 5/token
e 30/IP em 15 minutos. `AuthenticationEvent` e Pino registram o resultado com IDs ou hashes
protegidos, nunca senha, e-mail, IP, cookie ou token em texto aberto.
