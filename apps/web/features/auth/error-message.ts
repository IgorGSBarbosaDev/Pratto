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
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return messages[error.code] ?? error.message;
  return 'Não foi possível concluir a solicitação.';
}
