export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type EditableMenuStatus = 'DRAFT' | 'ACTIVE';

export interface MenuSummaryResponse {
  id: string;
  name: string;
  status: EditableMenuStatus;
}

export interface MenuListResponse {
  establishmentId: string;
  menus: MenuSummaryResponse[];
}

export interface CategoryResponse {
  id: string;
  menuId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: CategoryStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListResponse {
  menuId: string;
  categories: CategoryResponse[];
}

export interface CategoryMutationInput {
  name: string;
  description?: string | null;
}

export interface CategoryReorderInput {
  categoryIds: string[];
}
