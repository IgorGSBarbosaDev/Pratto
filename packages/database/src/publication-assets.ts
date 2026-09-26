import type { Prisma } from '@prisma/client';

type PublicationQueryClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** Returns whether any immutable publication still depends on an object key. */
export async function publicationReferencesStorageKey(
  database: PublicationQueryClient,
  storageKey: string,
): Promise<boolean> {
  const rows = await database.$queryRaw<Array<{ referenced: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM "menu_publications"
      WHERE jsonb_path_exists(
          "snapshot",
          '$.media[*].storageKey ? (@ == $key)',
          jsonb_build_object('key', ${storageKey})
        )
        OR jsonb_path_exists(
          "snapshot",
          '$.establishment.logo.storageKey ? (@ == $key)',
          jsonb_build_object('key', ${storageKey})
        )
        OR jsonb_path_exists(
          "snapshot",
          '$.establishment.coverImage.storageKey ? (@ == $key)',
          jsonb_build_object('key', ${storageKey})
        )
    ) AS "referenced"
  `;

  return rows[0]?.referenced ?? false;
}
