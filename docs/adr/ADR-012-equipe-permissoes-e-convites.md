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
`PermissionGuard` nas rotas. O guard resolve o estabelecimento informado diretamente ou por meio do
menu, sempre dentro da organização selecionada, e revalida no PostgreSQL a membership ativa e seu
papel atual antes de liberar o handler. As regras de alvo de equipe continuam reutilizadas no
serviço. `OWNER` tem
controle completo, incluindo `SETTINGS_MANAGE` e `OWNERSHIP_MANAGE`; `ADMIN` gerencia a operação e
membros não proprietários; `MEMBER` tem acesso de consulta ao estabelecimento e catálogo. A
interface filtra a navegação e deixa as mutações de catálogo em modo somente leitura quando o papel
não possui a permissão correspondente, sem substituir a validação da API.

Convites ficam em `membership_invitations`. O banco armazena somente o HMAC do token, com expiração
de sete dias, unicidade para convites pendentes por organização/e-mail e estados `PENDING`,
`ACCEPTED` e `CANCELED`. Expiração é derivada no momento da leitura, sem worker. A aceitação é
transacional: cria a conta e a credencial quando necessário, reativa uma membership inativa ou
cria a membership ativa, e marca o convite como aceito.

## Consequências

- Contas e memberships de proprietários existentes não precisam de backfill adicional.
- Reenvio substitui o hash e a validade do convite sem expor o token ao painel; cancelamento e
  aceitação também rotacionam o hash para invalidar imediatamente o token entregue.
- A remoção de membros é lógica; o banco preserva o vínculo histórico e a unicidade por usuário.
- O último proprietário não pode ser removido ou rebaixado.
- Administradores não podem criar, substituir, reenviar ou cancelar convites de proprietário.
- Mailpit continua sendo o adaptador de e-mail local; não há filas, workers ou provedor externo.
