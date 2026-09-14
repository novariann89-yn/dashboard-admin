import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./local.db";

if (!process.env.DATABASE_URL && process.env.VERCEL) {
  throw new Error(
    "DATABASE_URL belum diatur di Vercel. Set DATABASE_URL dan DATABASE_AUTH_TOKEN di Project Settings > Environment Variables.",
  );
}

if (process.env.DATABASE_URL?.startsWith("libsql://") && !process.env.DATABASE_AUTH_TOKEN) {
  throw new Error(
    "DATABASE_URL memakai Turso tetapi DATABASE_AUTH_TOKEN belum diatur.",
  );
}

const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({ url, authToken });

void client.execute("PRAGMA foreign_keys = ON").catch(() => {});

export const db = drizzle(client, { schema });
export { client };
