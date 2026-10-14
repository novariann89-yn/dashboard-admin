import { getDb } from "../db";
import type { Tombstone } from "../types";

export async function addTombstones(
  entries: { table: string; recordId: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  const now = Date.now();
  const rows: Tombstone[] = entries.map((entry) => ({
    key: `${entry.table}:${entry.recordId}`,
    table: entry.table,
    recordId: entry.recordId,
    deletedAt: now,
  }));
  await getDb().tombstones.bulkPut(rows);
}

export async function listTombstones(): Promise<Tombstone[]> {
  return getDb().tombstones.toArray();
}
