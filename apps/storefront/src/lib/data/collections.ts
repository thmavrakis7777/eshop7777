import { getCollectionBySlug, type Collection } from "@/lib/db/catalog";

export type { Collection };

export async function getCollectionByHandle(handle: string): Promise<Collection | undefined> {
  return getCollectionBySlug(handle);
}
