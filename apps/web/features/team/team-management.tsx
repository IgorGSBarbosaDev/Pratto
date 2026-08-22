'use client';

import {
  assignableRoles,
  canManageRole,
  type MembershipRole,
  type TeamInvitation,
  type TeamMember,
} from '@pratto/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MoreHorizontal, RefreshCw, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { authErrorMessage } from '../auth/error-message';
import { ConfirmDialog } from '../design-system/feedback';
import { Button, Field, Select, TextInput } from '../design-system/primitives';

import { teamApi } from './api-client';

const roleLabels: Record<MembershipRole, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
};

const invitationStatusLabels: Record<TeamInvitation['status'], string> = {
  PENDING: 'Pendente',
  EXPIRED: 'Expirado',
  ACCEPTED: 'Aceito',
  CANCELED: 'Cancelado',
};

export function TeamManagement({
  establishmentId,
  actorId,
  actorRole,
}: {
  establishmentId: string;
  actorId: string;
  actorRole: MembershipRole;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const initialInviteRole = assignableRoles(actorRole).includes('ADMIN') ? 'ADMIN' : 'MEMBER';
  const [role, setRole] = useState<MembershipRole>(initialInviteRole);
  const [confirm, setConfirm] = useState<
    | { kind: 'member'; id: string; label: string }
    | { kind: 'invitation'; id: string; label: string }
    | null
  >(null);
  const query = useQuery({
    queryKey: ['establishment-team', establishmentId],
    queryFn: () => teamApi.get(establishmentId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['establishment-team', establishmentId] });
  const invite = useMutation({
    mutationFn: () => teamApi.invite(establishmentId, { email, role }),
    onSuccess: () => {
      setEmail('');
      void refresh();
    },
  });
  const resend = useMutation({
    mutationFn: (invitationId: string) => teamApi.resend(establishmentId, invitationId),
    onSuccess: () => void refresh(),
  });
  const cancel = useMutation({
    mutationFn: (invitationId: string) => teamApi.cancel(establishmentId, invitationId),
    onSuccess: () => {
      setConfirm(null);
      void refresh();
    },
  });
  const updateRole = useMutation({
    mutationFn: ({ membershipId, nextRole }: { membershipId: string; nextRole: MembershipRole }) =>
      teamApi.updateRole(establishmentId, membershipId, nextRole),
    onSuccess: () => void refresh(),
  });
  const remove = useMutation({
    mutationFn: (membershipId: string) => teamApi.remove(establishmentId, membershipId),
    onSuccess: () => {
      setConfirm(null);
      void refresh();
    },
  });
  const isBusy =
    invite.isPending ||
    resend.isPending ||
    cancel.isPending ||
    updateRole.isPending ||
    remove.isPending;
  const error =
    invite.error ?? resend.error ?? cancel.error ?? updateRole.error ?? remove.error ?? query.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invite.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-[13px] font-medium text-ink-faint">Configurações / Equipe</p>
        <h1 className="mt-2 font-serif text-[42px] leading-none text-ink">Equipe</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          Controle quem pode colaborar no estabelecimento e qual nível de acesso cada pessoa possui.
        </p>
      </header>

      {error ? (
        <p className="pratto-error" role="alert">
          {authErrorMessage(error)}
        </p>
      ) : null}

      <section className="pratto-panel p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ink-faint">
              <Users size={16} aria-hidden="true" />
              <span className="text-[13px] font-medium">Membros atuais</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Acesso ao estabelecimento</h2>
          </div>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">
            {query.data?.members.length ?? '—'} pessoas
          </span>
        </div>

        {query.isPending ? (
          <div className="mt-6 space-y-3" role="status" aria-label="Carregando equipe">
            {[1, 2].map((item) => (
              <div className="skeleton h-16 rounded-xl" key={item} />
            ))}
          </div>
        ) : query.data?.members.length ? (
          <div className="mt-6 divide-y divide-line border-y border-line">
            {query.data.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                actorId={actorId}
                actorRole={actorRole}
                disabled={isBusy}
                onRoleChange={(nextRole) =>
                  updateRole.mutate({ membershipId: member.id, nextRole })
                }
                onRemove={() => setConfirm({ kind: 'member', id: member.id, label: member.email })}
              />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-faint">Nenhum membro ativo encontrado.</p>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div className="pratto-panel p-5 sm:p-7">
          <div className="flex items-center gap-2 text-ink-faint">
            <Mail size={16} aria-hidden="true" />
            <span className="text-[13px] font-medium">Novo convite</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Adicionar colaborador</h2>
          {assignableRoles(actorRole).length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-ink-faint">
              Seu perfil permite apenas consultar a equipe.
            </p>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <Field label="E-mail" required hint="O link será enviado para este endereço.">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field label="Papel" required>
                <Select
                  value={role}
                  onChange={(event) => setRole(event.target.value as MembershipRole)}
                >
                  {availableRoles(actorRole).map((item) => (
                    <option key={item} value={item}>
                      {roleLabels[item]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" disabled={isBusy || !email.trim()}>
                {invite.isPending ? 'Enviando…' : 'Enviar convite'}
              </Button>
              {invite.isSuccess ? (
                <p className="text-sm font-medium text-herb" role="status">
                  Convite enviado.
                </p>
              ) : null}
            </form>
          )}
        </div>

        <div className="pratto-panel p-5 sm:p-7">
          <div className="flex items-center gap-2 text-ink-faint">
            <ShieldCheck size={16} aria-hidden="true" />
            <span className="text-[13px] font-medium">Convites</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Aguardando resposta</h2>
          <InvitationList
            invitations={query.data?.invitations ?? []}
            actorRole={actorRole}
            disabled={isBusy}
            onResend={(id) => resend.mutate(id)}
            onCancel={(invitation) =>
              setConfirm({ kind: 'invitation', id: invitation.id, label: invitation.email })
            }
          />
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'member' ? 'Remover membro?' : 'Cancelar convite?'}
        description={confirm ? `${confirm.label} perderá o acesso a este estabelecimento.` : ''}
        confirmLabel={confirm?.kind === 'member' ? 'Remover acesso' : 'Cancelar convite'}
        pending={cancel.isPending || remove.isPending}
        error={
          cancel.error || remove.error ? authErrorMessage(cancel.error ?? remove.error) : undefined
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === 'member') remove.mutate(confirm.id);
          else cancel.mutate(confirm.id);
        }}
      />
    </div>
  );
}

function MemberRow({
  member,
  actorId,
  actorRole,
  disabled,
  onRoleChange,
  onRemove,
}: {
  member: TeamMember;
  actorId: string;
  actorRole: MembershipRole;
  disabled: boolean;
  onRoleChange: (role: MembershipRole) => void;
  onRemove: () => void;
}) {
  const canManage = member.userId !== actorId && canManageRole(actorRole, member.role);
  const options = availableRoles(actorRole, member.role);
  return (
    <div className="flex flex-wrap items-center gap-3 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink font-serif text-lg text-cream">
          {member.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
          <p className="truncate text-xs text-ink-faint">{member.email}</p>
        </div>
      </div>
      <Select
        aria-label={`Papel de ${member.email}`}
        className="w-44"
        value={member.role}
        disabled={!canManage || disabled}
        onChange={(event) => onRoleChange(event.target.value as MembershipRole)}
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {roleLabels[item]}
          </option>
        ))}
      </Select>
      {canManage ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-lg p-2 text-ink-faint hover:bg-accent/10 hover:text-accent-deep"
          aria-label={`Remover ${member.email}`}
        >
          <UserMinus size={17} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-9" aria-hidden="true" />
      )}
    </div>
  );
}

function InvitationList({
  invitations,
  actorRole,
  disabled,
  onResend,
  onCancel,
}: {
  invitations: TeamInvitation[];
  actorRole: MembershipRole;
  disabled: boolean;
  onResend: (id: string) => void;
  onCancel: (invitation: TeamInvitation) => void;
}) {
  if (!invitations.length)
    return <p className="mt-6 text-sm text-ink-faint">Nenhum convite enviado.</p>;
  return (
    <div className="mt-6 divide-y divide-line border-y border-line">
      {invitations.map((invitation) => {
        const pending = invitation.status === 'PENDING' || invitation.status === 'EXPIRED';
        return (
          <div key={invitation.id} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{invitation.email}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {roleLabels[invitation.role]} · {invitationStatusLabels[invitation.status]}
              </p>
            </div>
            {assignableRoles(actorRole).length > 0 && pending ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onResend(invitation.id)}
                  disabled={disabled}
                  className="rounded-lg p-2 text-ink-faint hover:bg-sand hover:text-ink"
                  aria-label={`Reenviar convite para ${invitation.email}`}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onCancel(invitation)}
                  disabled={disabled}
                  className="rounded-lg p-2 text-ink-faint hover:bg-accent/10 hover:text-accent-deep"
                  aria-label={`Cancelar convite para ${invitation.email}`}
                >
                  <MoreHorizontal size={17} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function availableRoles(actorRole: MembershipRole, targetRole?: MembershipRole): MembershipRole[] {
  if (targetRole && !canManageRole(actorRole, targetRole)) return [targetRole];
  return [...assignableRoles(actorRole)];
}
