# ADR-012 — Equipe do estabelecimento e convites

- Status: aceito
- Data: 2026-08-22

## Contexto

O modelo atual já possui `Organization`, `Membership` e `Establishment`, com o tenant resolvido
pela membership ativa da sessão. Os dados existentes não têm um `owner_id` separado: os donos já
foram materializados como memberships na migração de autenticação.

## Decisão

Manter `Membership` como fonte única de autorização. Nesta fase, a organização continua sendo o
escopo de autorização e o estabelecimento informado na rota é validado como pertencente ao tenant
ativo. Isso representa corretamente o cenário atual de um estabelecimento por organização sem
introduzir seleção por unidade ou duplicar memberships; a seleção por estabelecimento fica para a
fase de múltiplas unidades.

As permissões são definidas em `packages/contracts/src/authorization.ts` e aplicadas por
`PermissionGuard` nas rotas, com as regras de alvo de equipe reutilizadas no serviço. `OWNER` tem
controle completo; `ADMIN` gerencia a operação e membros não proprietários; `MEMBER` tem acesso de
consulta ao estabelecimento e catálogo.

Convites ficam em `membership_invitations`. O banco armazena somente o HMAC do token, com expiração
de sete dias, unicidade para convites pendentes por organização/e-mail e estados `PENDING`,
`ACCEPTED` e `CANCELED`. Expiração é derivada no momento da leitura, sem worker. A aceitação é
transacional: cria a conta e a credencial quando necessário, reativa uma membership inativa ou
cria a membership ativa, e marca o convite como aceito.

## Consequências

- Contas e memberships de proprietários existentes não precisam de backfill adicional.
- Reenvio substitui o hash e a validade do convite sem expor o token ao painel.
- A remoção de membros é lógica; o banco preserva o vínculo histórico e a unicidade por usuário.
- O último proprietário não pode ser removido ou rebaixado.
- Mailpit continua sendo o adaptador de e-mail local; não há filas, workers ou provedor externo.
