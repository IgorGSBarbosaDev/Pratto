'use client';

import {
  assignableRoles,
  canManageRole,
  hasPermission,
  Permission,
  type MembershipRole,
  type TeamInvitation,
  type TeamMember,
} from '@pratto/contracts';
import { teamInviteSchema } from '@pratto/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Check,
  Eye,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

import { authErrorMessage } from '../auth/error-message';
import { ConfirmDialog, EmptyState, ErrorState } from '../design-system/feedback';
import { Button, Field, Select, TextInput } from '../design-system/primitives';
import { useModalDialog } from '../design-system/use-modal-dialog';

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

const roleRank: Record<MembershipRole, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

type Confirmation =
  | { kind: 'remove-member'; id: string; label: string }
  | { kind: 'cancel-invitation'; id: string; label: string }
  | {
      kind: 'role-change';
      id: string;
      label: string;
      currentRole: MembershipRole;
      nextRole: MembershipRole;
    }
  | null;

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>(
    availableRoles(actorRole)[0] ?? 'MEMBER',
  );
  const [inviteValidationError, setInviteValidationError] = useState<string>();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [feedback, setFeedback] = useState<string>();

  const canInvite = hasPermission(actorRole, Permission.TEAM_INVITE);
  const canManageMembers = hasPermission(actorRole, Permission.TEAM_MANAGE);
  const query = useQuery({
    queryKey: ['establishment-team', establishmentId],
    queryFn: () => teamApi.get(establishmentId),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['establishment-team', establishmentId] });

  const invite = useMutation({
    mutationFn: (input: { email: string; role: MembershipRole }) =>
      teamApi.invite(establishmentId, input),
    onSuccess: (invitation) => {
      setEmail('');
      setInviteOpen(false);
      setFeedback(`Convite enviado para ${invitation.email}.`);
      void refresh();
    },
  });
  const resend = useMutation({
    mutationFn: (invitationId: string) => teamApi.resend(establishmentId, invitationId),
    onSuccess: (invitation) => {
      setFeedback(`Convite reenviado para ${invitation.email}.`);
      void refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: (invitationId: string) => teamApi.cancel(establishmentId, invitationId),
    onSuccess: () => {
      setConfirmation(null);
      setFeedback('Convite cancelado.');
      void refresh();
    },
  });
  const updateRole = useMutation({
    mutationFn: ({ membershipId, nextRole }: { membershipId: string; nextRole: MembershipRole }) =>
      teamApi.updateRole(establishmentId, membershipId, nextRole),
    onSuccess: (member) => {
      setConfirmation(null);
      setFeedback(`${member.name} agora é ${roleLabels[member.role].toLocaleLowerCase()}.`);
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (membershipId: string) => teamApi.remove(establishmentId, membershipId),
    onSuccess: () => {
      setConfirmation(null);
      setFeedback('Acesso do membro removido.');
      void refresh();
    },
  });

  const actionError = resend.error ?? updateRole.error;
  const pendingInvitations = (query.data?.invitations ?? []).filter(isActionableInvitation);
  const isBusy =
    invite.isPending ||
    resend.isPending ||
    cancel.isPending ||
    updateRole.isPending ||
    remove.isPending;

  function openInvite() {
    invite.reset();
    setInviteValidationError(undefined);
    setFeedback(undefined);
    setInviteOpen(true);
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = teamInviteSchema.safeParse({ email: email.trim(), role: inviteRole });
    if (!parsed.success) {
      setInviteValidationError('Informe um endereço de e-mail válido.');
      return;
    }
    setInviteValidationError(undefined);
    invite.mutate(parsed.data);
  }

  function changeRole(member: TeamMember, nextRole: MembershipRole) {
    if (
      !canManageMembers ||
      member.userId === actorId ||
      !canManageRole(actorRole, member.role, nextRole)
    ) {
      return;
    }
    setFeedback(undefined);
    if (roleRank[nextRole] < roleRank[member.role]) {
      setConfirmation({
        kind: 'role-change',
        id: member.id,
        label: member.name,
        currentRole: member.role,
        nextRole,
      });
      return;
    }
    updateRole.mutate({ membershipId: member.id, nextRole });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="font-serif text-[42px] leading-none text-ink">Equipe</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Gerencie quem pode colaborar no estabelecimento e o nível de acesso de cada pessoa.
          </p>
        </div>
        {canInvite ? (
          <Button type="button" onClick={openInvite}>
            <Mail size={17} aria-hidden="true" />
            Convidar membro
          </Button>
        ) : null}
      </header>

      {feedback ? (
        <div
          className="flex items-start gap-2 rounded-xl border border-herb/20 bg-herb/10 px-4 py-3 text-sm font-medium text-herb"
          role="status"
          aria-live="polite"
        >
          <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      ) : null}
      {actionError ? (
        <p className="pratto-error" role="alert">
          {authErrorMessage(actionError)}
        </p>
      ) : null}

      <section className="pratto-panel p-5 sm:p-7" aria-labelledby="team-members-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ink-faint">
              <Users size={16} aria-hidden="true" />
              <span className="text-[13px] font-medium">Acesso ao estabelecimento</span>
            </div>
            <h2 id="team-members-title" className="mt-2 text-xl font-semibold text-ink">
              Membros atuais
            </h2>
          </div>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">
            {query.data?.members.length ?? '—'} pessoas
          </span>
        </div>

        {query.isPending ? (
          <div className="mt-6 space-y-3" role="status" aria-label="Carregando equipe">
            {[1, 2, 3].map((item) => (
              <div className="skeleton h-20 rounded-xl" key={item} />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Não foi possível carregar a equipe"
            description={authErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.members.length ? (
          <div className="mt-6 divide-y divide-line border-y border-line" role="list">
            {query.data.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                actorId={actorId}
                actorRole={actorRole}
                canManageMembers={canManageMembers}
                disabled={isBusy}
                onView={() => setSelectedMember(member)}
                onRoleChange={(nextRole) => changeRole(member, nextRole)}
                onRemove={() => {
                  setFeedback(undefined);
                  setConfirmation({ kind: 'remove-member', id: member.id, label: member.name });
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum membro ativo"
            description="Quando alguém aceitar um convite, aparecerá nesta lista."
            compact
          />
        )}
      </section>

      <section className="pratto-panel p-5 sm:p-7" aria-labelledby="team-invitations-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ink-faint">
              <ShieldCheck size={16} aria-hidden="true" />
              <span className="text-[13px] font-medium">Acesso em andamento</span>
            </div>
            <h2 id="team-invitations-title" className="mt-2 text-xl font-semibold text-ink">
              Convites
            </h2>
            <p className="mt-1 text-sm text-ink-faint">
              {pendingInvitations.length
                ? `${pendingInvitations.length} convite${pendingInvitations.length === 1 ? '' : 's'} aguardando resposta.`
                : 'Nenhum convite pendente no momento.'}
            </p>
          </div>
          {canInvite ? (
            <Button type="button" variant="soft" size="sm" onClick={openInvite}>
              <Mail size={16} aria-hidden="true" />
              Novo convite
            </Button>
          ) : null}
        </div>

        {query.isPending || query.isError ? null : (
          <InvitationList
            invitations={query.data.invitations}
            canInvite={canInvite}
            disabled={isBusy}
            onResend={(id) => {
              setFeedback(undefined);
              resend.mutate(id);
            }}
            onCancel={(invitation) => {
              setFeedback(undefined);
              setConfirmation({
                kind: 'cancel-invitation',
                id: invitation.id,
                label: invitation.email,
              });
            }}
          />
        )}
      </section>

      <InviteMemberDialog
        open={inviteOpen}
        email={email}
        role={inviteRole}
        roles={availableRoles(actorRole)}
        pending={invite.isPending}
        validationError={inviteValidationError}
        serverError={invite.error ? authErrorMessage(invite.error) : undefined}
        onClose={() => {
          if (!invite.isPending) setInviteOpen(false);
        }}
        onEmailChange={setEmail}
        onRoleChange={setInviteRole}
        onSubmit={submitInvite}
      />

      <MemberDetailsDialog member={selectedMember} onClose={() => setSelectedMember(null)} />

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmationTitle(confirmation)}
        description={confirmationDescription(confirmation)}
        confirmLabel={confirmationConfirmLabel(confirmation)}
        pending={cancel.isPending || remove.isPending || updateRole.isPending}
        error={confirmationError(confirmation, cancel.error, remove.error, updateRole.error)}
        onCancel={() => {
          if (!cancel.isPending && !remove.isPending && !updateRole.isPending) {
            setConfirmation(null);
          }
        }}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.kind === 'remove-member') remove.mutate(confirmation.id);
          else if (confirmation.kind === 'cancel-invitation') cancel.mutate(confirmation.id);
          else
            updateRole.mutate({ membershipId: confirmation.id, nextRole: confirmation.nextRole });
        }}
      />
    </div>
  );
}

function MemberRow({
  member,
  actorId,
  actorRole,
  canManageMembers,
  disabled,
  onView,
  onRoleChange,
  onRemove,
}: {
  member: TeamMember;
  actorId: string;
  actorRole: MembershipRole;
  canManageMembers: boolean;
  disabled: boolean;
  onView: () => void;
  onRoleChange: (role: MembershipRole) => void;
  onRemove: () => void;
}) {
  const canManage =
    canManageMembers && member.userId !== actorId && canManageRole(actorRole, member.role);
  const options = canManage ? availableRoles(actorRole, member.role) : [];

  return (
    <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center" role="listitem">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink font-serif text-lg text-cream"
          aria-hidden="true"
        >
          {member.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
          <p className="truncate text-xs text-ink-faint">{member.email}</p>
          <span className="mt-1 inline-flex rounded-full bg-herb/10 px-2 py-0.5 text-[11px] font-medium text-herb">
            {member.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {canManage ? (
          <Select
            aria-label={`Papel de ${member.email}`}
            className="min-w-0 flex-1 sm:w-44 sm:flex-none"
            value={member.role}
            disabled={disabled}
            onChange={(event) => onRoleChange(event.target.value as MembershipRole)}
          >
            {options.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </Select>
        ) : (
          <span className="rounded-full bg-sand px-3 py-2 text-xs font-medium text-ink-soft">
            {roleLabels[member.role]}
          </span>
        )}
        <button
          type="button"
          onClick={onView}
          className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-ink-faint transition hover:bg-sand hover:text-ink"
          aria-label={`Ver informações de ${member.email}`}
        >
          <Eye size={17} aria-hidden="true" />
        </button>
        {canManage ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-ink-faint transition hover:bg-accent/10 hover:text-accent-deep"
            aria-label={`Remover ${member.email}`}
          >
            <UserMinus size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InvitationList({
  invitations,
  canInvite,
  disabled,
  onResend,
  onCancel,
}: {
  invitations: TeamInvitation[];
  canInvite: boolean;
  disabled: boolean;
  onResend: (id: string) => void;
  onCancel: (invitation: TeamInvitation) => void;
}) {
  if (!invitations.length) {
    return (
      <EmptyState
        icon={Mail}
        title="Nenhum convite enviado"
        description="Convites pendentes e seu histórico aparecerão aqui."
        compact
      />
    );
  }

  return (
    <div className="mt-6 divide-y divide-line border-y border-line" role="list">
      {invitations.map((invitation) => {
        const actionable = isActionableInvitation(invitation);
        return (
          <div
            key={invitation.id}
            className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center"
            role="listitem"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{invitation.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                <span>{roleLabels[invitation.role]}</span>
                <span aria-hidden="true">·</span>
                <InvitationStatus status={invitation.status} />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                <CalendarClock size={13} aria-hidden="true" />
                {invitation.status === 'PENDING' || invitation.status === 'EXPIRED'
                  ? invitation.status === 'EXPIRED'
                    ? `Expirou em ${formatDate(invitation.expiresAt)}`
                    : `Expira em ${formatDate(invitation.expiresAt)}`
                  : `Atualizado em ${formatDate(invitation.updatedAt)}`}
              </p>
            </div>
            {canInvite && actionable ? (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => onResend(invitation.id)}
                  disabled={disabled}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium text-ink-soft transition hover:bg-sand hover:text-ink"
                  aria-label={`Reenviar convite para ${invitation.email}`}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={() => onCancel(invitation)}
                  disabled={disabled}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium text-ink-soft transition hover:bg-accent/10 hover:text-accent-deep"
                  aria-label={`Cancelar convite para ${invitation.email}`}
                >
                  <X size={15} aria-hidden="true" />
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function InviteMemberDialog({
  open,
  email,
  role,
  roles,
  pending,
  validationError,
  serverError,
  onClose,
  onEmailChange,
  onRoleChange,
  onSubmit,
}: {
  open: boolean;
  email: string;
  role: MembershipRole;
  roles: MembershipRole[];
  pending: boolean;
  validationError?: string;
  serverError?: string;
  onClose: () => void;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: MembershipRole) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useModalDialog(open, dialogRef, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar convite"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 bg-ink/45 disabled:cursor-not-allowed"
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-member-title"
        className="relative w-full max-w-lg rounded-2xl bg-cream p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Novo acesso
            </p>
            <h2 id="invite-member-title" className="mt-2 font-serif text-3xl text-ink">
              Convidar membro
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              O convite expira em 7 dias e será enviado por e-mail.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fechar janela de convite"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-sand hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form className="mt-6 space-y-5" noValidate onSubmit={onSubmit}>
          <Field
            label="E-mail"
            required
            error={validationError}
            hint={validationError ? undefined : 'Use o endereço da pessoa que vai colaborar.'}
          >
            <TextInput
              data-dialog-initial-focus
              type="email"
              value={email}
              autoComplete="email"
              placeholder="nome@exemplo.com"
              invalid={Boolean(validationError)}
              aria-invalid={Boolean(validationError)}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </Field>
          <Field
            label="Papel"
            required
            hint="Você poderá ajustar o papel depois, se tiver permissão."
          >
            <Select
              value={role}
              onChange={(event) => onRoleChange(event.target.value as MembershipRole)}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              ))}
            </Select>
          </Field>
          {serverError ? (
            <p className="pratto-error" role="alert">
              {serverError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MemberDetailsDialog({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useModalDialog(Boolean(member), dialogRef, onClose);

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar informações"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45"
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-details-title"
        className="relative w-full max-w-md rounded-2xl bg-cream p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Informações do membro
            </p>
            <h2 id="member-details-title" className="mt-2 font-serif text-3xl text-ink">
              {member.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar informações do membro"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-sand hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
          <DetailRow label="E-mail" value={member.email} />
          <DetailRow label="Papel" value={roleLabels[member.role]} />
          <DetailRow label="Status" value={member.status === 'ACTIVE' ? 'Ativo' : 'Inativo'} />
          <DetailRow label="Membro desde" value={formatDate(member.createdAt)} />
        </dl>
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="soft" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 py-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="max-w-[70%] text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function InvitationStatus({ status }: { status: TeamInvitation['status'] }) {
  const Icon: LucideIcon = status === 'PENDING' ? CalendarClock : ShieldCheck;
  const color = status === 'PENDING' ? 'bg-accent/10 text-accent-deep' : 'bg-sand text-ink-soft';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${color}`}
    >
      <Icon size={12} aria-hidden="true" />
      {invitationStatusLabels[status]}
    </span>
  );
}

function isActionableInvitation(invitation: TeamInvitation) {
  return invitation.status === 'PENDING' || invitation.status === 'EXPIRED';
}

function availableRoles(actorRole: MembershipRole, targetRole?: MembershipRole): MembershipRole[] {
  if (targetRole && !canManageRole(actorRole, targetRole)) return [targetRole];
  return [...assignableRoles(actorRole)];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'data indisponível' : dateFormatter.format(date);
}

function confirmationTitle(confirmation: Confirmation) {
  if (!confirmation) return '';
  if (confirmation.kind === 'remove-member') return 'Remover membro?';
  if (confirmation.kind === 'cancel-invitation') return 'Cancelar convite?';
  return 'Reduzir nível de acesso?';
}

function confirmationDescription(confirmation: Confirmation) {
  if (!confirmation) return '';
  if (confirmation.kind === 'remove-member') {
    return `${confirmation.label} perderá o acesso a este estabelecimento.`;
  }
  if (confirmation.kind === 'cancel-invitation') {
    return `O convite para ${confirmation.label} deixará de ser válido.`;
  }
  return `${confirmation.label} passará de ${roleLabels[confirmation.currentRole]} para ${roleLabels[confirmation.nextRole]}.`;
}

function confirmationConfirmLabel(confirmation: Confirmation) {
  if (!confirmation) return 'Confirmar';
  if (confirmation.kind === 'remove-member') return 'Remover acesso';
  if (confirmation.kind === 'cancel-invitation') return 'Cancelar convite';
  return 'Reduzir acesso';
}

function confirmationError(
  confirmation: Confirmation,
  cancelError: unknown,
  removeError: unknown,
  updateRoleError: unknown,
) {
  if (!confirmation) return undefined;
  const error =
    confirmation.kind === 'cancel-invitation'
      ? cancelError
      : confirmation.kind === 'remove-member'
        ? removeError
        : updateRoleError;
  return error ? authErrorMessage(error) : undefined;
}
