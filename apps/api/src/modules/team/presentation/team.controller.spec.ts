import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

import { PublicInvitationController, TeamController } from './team.controller';

const establishmentId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const tenant = { organizationId: 'organization-id', role: 'OWNER' } as TenantPrincipal;
const request = { tenant } as never;

describe('TeamController', () => {
  const service = {
    getTeam: jest.fn(),
    invite: jest.fn(),
    resend: jest.fn(),
    cancel: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
  };
  let controller: TeamController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TeamController(service as never);
  });

  it('delegates validated team operations with the explicit tenant and IDs', async () => {
    service.getTeam.mockResolvedValue({});
    service.invite.mockResolvedValue({});
    service.resend.mockResolvedValue({});
    service.cancel.mockResolvedValue(undefined);
    service.updateMember.mockResolvedValue({});
    service.removeMember.mockResolvedValue(undefined);
    await controller.getTeam(establishmentId, request);
    await controller.invite(
      establishmentId,
      { email: 'person@example.com', role: 'MEMBER' },
      request,
    );
    await controller.resend(establishmentId, membershipId, request);
    await controller.cancel(establishmentId, membershipId, request);
    await controller.updateMember(establishmentId, membershipId, { role: 'ADMIN' }, request);
    await controller.removeMember(establishmentId, membershipId, request);
    expect(service.getTeam).toHaveBeenCalledWith(tenant, establishmentId);
    expect(service.invite).toHaveBeenCalledWith(tenant, establishmentId, {
      email: 'person@example.com',
      role: 'MEMBER',
    });
    expect(service.resend).toHaveBeenCalledWith(tenant, establishmentId, membershipId);
    expect(service.updateMember).toHaveBeenCalledWith(tenant, establishmentId, membershipId, {
      role: 'ADMIN',
    });
    expect(service.removeMember).toHaveBeenCalledWith(tenant, establishmentId, membershipId);
  });

  it('rejects malformed IDs and unknown body fields before touching the service', () => {
    expect(() => controller.getTeam('not-a-uuid', request)).toThrow(StableHttpException);
    expect(() =>
      controller.invite(establishmentId, { email: 'bad', role: 'MEMBER', extra: true }, request),
    ).toThrow(StableHttpException);
    expect(() => controller.updateMember(establishmentId, membershipId, {}, request)).toThrow(
      StableHttpException,
    );
    expect(service.invite).not.toHaveBeenCalled();
    expect(service.updateMember).not.toHaveBeenCalled();
  });
});

describe('PublicInvitationController', () => {
  it('validates preview and acceptance payloads before delegation', async () => {
    const service = {
      preview: jest.fn().mockResolvedValue({}),
      accept: jest.fn().mockResolvedValue({}),
    };
    const controller = new PublicInvitationController(service as never);
    const token = 't'.repeat(40);
    await controller.preview({ token });
    await controller.accept({ token, name: 'Person', password: 'a'.repeat(15) });
    expect(service.preview).toHaveBeenCalledWith(token);
    expect(service.accept).toHaveBeenCalledWith({
      token,
      name: 'Person',
      password: 'a'.repeat(15),
    });
    expect(() => controller.preview({ token: 'short' })).toThrow(StableHttpException);
    expect(service.preview).toHaveBeenCalledTimes(1);
  });
});
