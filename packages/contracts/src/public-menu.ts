import type {
  EstablishmentAddress,
  EstablishmentAsset,
  EstablishmentOperatingHours,
  EstablishmentThemeSettings,
} from './establishment';

export type PublicProductAvailability = 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE';

export interface PublicMenuMediaResponse {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  contentType: string;
  url: string;
}

export interface PublicMenuCategoryResponse {
  id: string;
  name: string;
  description: string | null;
}

export interface PublicMenuProductResponse {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  promotionalPrice: string | null;
  ingredients: string | null;
  allergens: string | null;
  availability: PublicProductAvailability;
  featured: boolean;
  media: PublicMenuMediaResponse[];
}

export interface PublicEstablishmentResponse {
  publicId: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: EstablishmentAddress | null;
  operatingHours: EstablishmentOperatingHours;
  logo: EstablishmentAsset | null;
  coverImage: EstablishmentAsset | null;
  theme: EstablishmentThemeSettings;
}

export interface PublicMenuPageResponse {
  establishment: PublicEstablishmentResponse;
  menu: {
    name: string;
    version: number;
    publishedAt: string;
  };
  categories: PublicMenuCategoryResponse[];
  products: PublicMenuProductResponse[];
  nextCursor: string | null;
}
