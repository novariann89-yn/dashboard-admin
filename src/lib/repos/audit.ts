import { getDb } from "../db";
import { newId } from "../id";
import type { AuditLog } from "../types";

export async function logAudit(input: {
  action: string;
  table: string;
  recordId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}): Promise<void> {
  const entry: AuditLog = {
    id: newId(),
    at: Date.now(),
    action: input.action,
    table: input.table,
    recordId: input.recordId ?? null,
    oldData: input.oldData === undefined ? null : JSON.stringify(input.oldData),
    newData: input.newData === undefined ? null : JSON.stringify(input.newData),
  };
  await getDb().auditLog.add(entry);
}

export async function listAudit(limit = 50): Promise<AuditLog[]> {
  const rows = await getDb().auditLog.toArray();
  return rows.sort((a, b) => b.at - a.at).slice(0, limit);
}