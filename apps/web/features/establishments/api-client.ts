import type {
  EstablishmentAssetKind,
  EstablishmentSettingsResponse,
  UpdateEstablishmentInput,
} from '@pratto/contracts';

import { request } from '../auth/api-client';

export const establishmentApi = {
  get: (establishmentId: string) =>
    request<EstablishmentSettingsResponse>(`/admin/establishments/${establishmentId}/settings`),
  update: (establishmentId: string, input: UpdateEstablishmentInput) =>
    request<EstablishmentSettingsResponse>(`/admin/establishments/${establishmentId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      csrf: true,
    }),
  uploadAsset: (establishmentId: string, kind: EstablishmentAssetKind, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<EstablishmentSettingsResponse>(
      `/admin/establishments/${establishmentId}/assets/${kind}`,
      { method: 'POST', body, csrf: true },
    );
  },
  removeAsset: (establishmentId: string, kind: EstablishmentAssetKind) =>
    request<EstablishmentSettingsResponse>(
      `/admin/establishments/${establishmentId}/assets/${kind}`,
      { method: 'DELETE', csrf: true },
    ),
};
