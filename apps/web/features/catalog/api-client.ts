import type {
  CategoryListResponse,
  CategoryMutationInput,
  CategoryReorderInput,
  CategoryResponse,
  MenuListResponse,
  ProductCreateInput,
  ProductListResponse,
  ProductResponse,
  ProductReorderInput,
  ProductUpdateInput,
} from '@pratto/contracts';

import { request } from '../auth/api-client';

export const catalogApi = {
  listMenusForEstablishment: (establishmentId: string) =>
    request<MenuListResponse>(`/admin/establishments/${establishmentId}/menus`),
  listCategories: (menuId: string) =>
    request<CategoryListResponse>(`/admin/menus/${menuId}/categories`),
  createCategory: (menuId: string, input: CategoryMutationInput) =>
    request<CategoryResponse>(`/admin/menus/${menuId}/categories`, {
      method: 'POST',
      body: JSON.stringify(input),
      csrf: true,
    }),
  updateCategory: (menuId: string, categoryId: string, input: CategoryMutationInput) =>
    request<CategoryResponse>(`/admin/menus/${menuId}/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      csrf: true,
    }),
  activateCategory: (menuId: string, categoryId: string) =>
    request<CategoryResponse>(`/admin/menus/${menuId}/categories/${categoryId}/activate`, {
      method: 'POST',
      csrf: true,
    }),
  deactivateCategory: (menuId: string, categoryId: string) =>
    request<CategoryResponse>(`/admin/menus/${menuId}/categories/${categoryId}/deactivate`, {
      method: 'POST',
      csrf: true,
    }),
  archiveCategory: (menuId: string, categoryId: string) =>
    request<CategoryResponse>(`/admin/menus/${menuId}/categories/${categoryId}/archive`, {
      method: 'POST',
      csrf: true,
    }),
  reorderCategories: (menuId: string, input: CategoryReorderInput) =>
    request<CategoryListResponse>(`/admin/menus/${menuId}/categories/reorder`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      csrf: true,
    }),
  listProducts: (menuId: string) => request<ProductListResponse>(`/admin/menus/${menuId}/products`),
  createProduct: (menuId: string, input: ProductCreateInput) =>
    request<ProductResponse>(`/admin/menus/${menuId}/products`, {
      method: 'POST',
      body: JSON.stringify(input),
      csrf: true,
    }),
  updateProduct: (menuId: string, productId: string, input: ProductUpdateInput) =>
    request<ProductResponse>(`/admin/menus/${menuId}/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      csrf: true,
    }),
  activateProduct: (menuId: string, productId: string) =>
    request<ProductResponse>(`/admin/menus/${menuId}/products/${productId}/activate`, {
      method: 'POST',
      csrf: true,
    }),
  deactivateProduct: (menuId: string, productId: string) =>
    request<ProductResponse>(`/admin/menus/${menuId}/products/${productId}/deactivate`, {
      method: 'POST',
      csrf: true,
    }),
  archiveProduct: (menuId: string, productId: string) =>
    request<ProductResponse>(`/admin/menus/${menuId}/products/${productId}/archive`, {
      method: 'POST',
      csrf: true,
    }),
  reorderProducts: (menuId: string, input: ProductReorderInput) =>
    request<ProductListResponse>(`/admin/menus/${menuId}/products/reorder`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      csrf: true,
    }),
};
