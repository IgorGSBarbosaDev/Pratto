export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type EditableMenuStatus = 'DRAFT' | 'ACTIVE';
export type ProductStatus = 'ACTIVE' | 'INACTIVE';
export type ProductAvailability = 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE' | 'HIDDEN';

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

export interface ProductResponse {
  id: string;
  menuId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  promotionalPrice: string | null;
  ingredients: string | null;
  allergens: string | null;
  availability: ProductAvailability;
  featured: boolean;
  status: ProductStatus;
  archivedAt: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  menuId: string;
  products: ProductResponse[];
}

export interface ProductCreateInput {
  categoryId: string;
  name: string;
  description?: string | null;
  price: string;
  promotionalPrice?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  availability?: ProductAvailability;
  featured?: boolean;
}

export interface ProductUpdateInput {
  categoryId?: string;
  name?: string;
  description?: string | null;
  price?: string;
  promotionalPrice?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  availability?: ProductAvailability;
  featured?: boolean;
}

export interface ProductReorderInput {
  productIds: string[];
}
