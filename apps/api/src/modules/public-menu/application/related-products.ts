interface RelatedProductCandidate {
  id: string;
  categoryId: string;
  availability: 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE' | 'HIDDEN';
  featured: boolean;
  displayOrder: number;
}

/**
 * Keep recommendation rules deterministic and replaceable independently from the public-menu UI.
 */
export function selectRelatedProducts<T extends RelatedProductCandidate>(
  products: readonly T[],
  currentProduct: T,
  limit: number,
): T[] {
  return products
    .filter((product) => product.id !== currentProduct.id && product.availability === 'AVAILABLE')
    .sort(
      (left, right) =>
        Number(right.categoryId === currentProduct.categoryId) -
          Number(left.categoryId === currentProduct.categoryId) ||
        Number(right.featured) - Number(left.featured) ||
        left.displayOrder - right.displayOrder ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}
