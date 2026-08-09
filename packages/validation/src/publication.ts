import { z } from 'zod';

export const publicationIdempotencyKeySchema = z.string().trim().min(1).max(128);

export type PublicationIdempotencyKey = z.infer<typeof publicationIdempotencyKeySchema>;
