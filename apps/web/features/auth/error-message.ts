import { ApiClientError } from './api-client';

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  RATE_LIMIT_EXCEEDED: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  SESSION_EXPIRED: 'Sua sessão expirou. Entre novamente.',
  SESSION_REVOKED: 'Sua sessão foi encerrada. Entre novamente.',
  AUTHENTICATION_REQUIRED: 'Entre para continuar.',
  ORGANIZATION_ACCESS_DENIED: 'Você não tem acesso a essa organização.',
  PASSWORD_RESET_TOKEN_INVALID: 'Este link de redefinição é inválido ou já foi usado.',
  PASSWORD_RESET_TOKEN_EXPIRED: 'Este link expirou. Solicite um novo.',
  CSRF_TOKEN_INVALID: 'A sessão de segurança mudou. Atualize a página e tente novamente.',
  MEMBERSHIP_ALREADY_EXISTS: 'Este usuário já faz parte da equipe.',
  INVITATION_ALREADY_PENDING: 'Já existe um convite pendente para este e-mail.',
  INVITATION_NOT_PENDING: 'Este convite não está mais pendente.',
  LAST_OWNER_REQUIRED: 'A equipe precisa manter pelo menos um proprietário ativo.',
  ROLE_ASSIGNMENT_DENIED: 'Seu perfil não pode atribuir este papel.',
  TEAM_MEMBER_MANAGEMENT_DENIED: 'Seu perfil não pode alterar este membro.',
  SELF_MANAGEMENT_NOT_ALLOWED: 'Você não pode alterar o próprio acesso.',
  PERMISSION_DENIED: 'Seu perfil não possui permissão para esta operação.',
  INVITATION_INVALID: 'Este convite é inválido ou expirou.',
  ACCOUNT_DETAILS_REQUIRED: 'Informe nome e senha para criar o acesso.',
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return messages[error.code] ?? error.message;
  return 'Não foi possível concluir a solicitação.';
}
