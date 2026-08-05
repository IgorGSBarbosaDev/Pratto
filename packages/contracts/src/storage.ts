export interface UploadInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  contentLength: number;
}

export interface StoredFile {
  key: string;
  contentType: string;
  contentLength: number;
  publicUrl: string;
}

export interface StorageService {
  upload(input: UploadInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  health(): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
