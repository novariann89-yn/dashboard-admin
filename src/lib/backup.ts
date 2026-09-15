import { getDb } from "./db";
import { updateSettings } from "./settings";

const BACKUP_APP = "dashboard-admin";
const BACKUP_VERSION = 1;

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: number;
  data: Record<string, unknown[]>;
}

export async function buildBackup(): Promise<BackupFile> {
  const db = getDb();
  const data: Record<string, unknown[]> = {};

  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data,
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-toko-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  await updateSettings({ lastBackupAt: Date.now() });
}

export async function importBackup(json: string): Promise<void> {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(json) as BackupFile;
  } catch {
    throw new Error("File backup tidak bisa dibaca");
  }

  if (parsed.app !== BACKUP_APP || !parsed.data) {
    throw new Error("File ini bukan backup aplikasi ini");
  }
  if (typeof parsed.version !== "number" || parsed.version > BACKUP_VERSION) {
    throw new Error("Versi backup tidak didukung");
  }

  const db = getDb();

  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const rows = parsed.data[table.name];
      if (Array.isArray(rows) && rows.length > 0) {
        await table.bulkAdd(rows);
      }
    }
  });
}