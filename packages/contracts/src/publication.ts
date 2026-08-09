export interface MenuPublicationResponse {
  id: string;
  menuId: string;
  version: number;
  snapshot: Record<string, unknown>;
  publishedAt: string;
  publishedBy: string;
}

export interface ActiveMenuPublicationResponse {
  menuId: string;
  publication: MenuPublicationResponse | null;
}

export interface MenuPublicationSummaryResponse {
  id: string;
  menuId: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface MenuPublicationHistoryResponse {
  menuId: string;
  publications: MenuPublicationSummaryResponse[];
}
