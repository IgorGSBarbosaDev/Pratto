import { selectRelatedProducts } from './related-products';

const current = {
  id: 'current',
  categoryId: 'category-a',
  availability: 'AVAILABLE' as const,
  featured: false,
  displayOrder: 0,
};

describe('selectRelatedProducts', () => {
  it('prioritizes same category, then featured, order and id deterministically', () => {
    const products = [
      current,
      {
        id: 'other-featured',
        categoryId: 'category-b',
        availability: 'AVAILABLE' as const,
        featured: true,
        displayOrder: 0,
      },
      {
        id: 'same-late',
        categoryId: 'category-a',
        availability: 'AVAILABLE' as const,
        featured: false,
        displayOrder: 2,
      },
      {
        id: 'same-featured',
        categoryId: 'category-a',
        availability: 'AVAILABLE' as const,
        featured: true,
        displayOrder: 9,
      },
      {
        id: 'same-early',
        categoryId: 'category-a',
        availability: 'AVAILABLE' as const,
        featured: false,
        displayOrder: 1,
      },
      {
        id: 'hidden',
        categoryId: 'category-a',
        availability: 'HIDDEN' as const,
        featured: true,
        displayOrder: -1,
      },
      {
        id: 'unavailable',
        categoryId: 'category-a',
        availability: 'TEMPORARILY_UNAVAILABLE' as const,
        featured: true,
        displayOrder: -1,
      },
    ];
    expect(selectRelatedProducts(products, current, 4).map((product) => product.id)).toEqual([
      'same-featured',
      'same-early',
      'same-late',
      'other-featured',
    ]);
  });

  it('excludes the current product and honors zero or oversized limits', () => {
    expect(selectRelatedProducts([current], current, 0)).toEqual([]);
    expect(selectRelatedProducts([current], current, 10)).toEqual([]);
  });
});
