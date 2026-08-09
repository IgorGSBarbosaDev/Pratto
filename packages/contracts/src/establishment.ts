export type EstablishmentAssetKind = 'logo' | 'cover';

export type EstablishmentThemeMode = 'LIGHT' | 'DARK';

export interface EstablishmentAsset {
  url: string;
  contentType: string;
}

export interface EstablishmentAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface EstablishmentDayHours {
  closed: boolean;
  open: string;
  close: string;
}

export interface EstablishmentOperatingHours {
  monday: EstablishmentDayHours;
  tuesday: EstablishmentDayHours;
  wednesday: EstablishmentDayHours;
  thursday: EstablishmentDayHours;
  friday: EstablishmentDayHours;
  saturday: EstablishmentDayHours;
  sunday: EstablishmentDayHours;
}

export interface EstablishmentThemeSettings {
  mode: EstablishmentThemeMode;
  primaryColor: string;
}

export interface EstablishmentSettingsResponse {
  id: string;
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

export interface UpdateEstablishmentInput {
  name?: string;
  slug?: string;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: EstablishmentAddress | null;
  operatingHours?: EstablishmentOperatingHours;
  theme?: EstablishmentThemeSettings;
}
