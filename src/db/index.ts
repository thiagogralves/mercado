import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Remove aspas acidentais de valores vindos do Vercel/.env */
function cleanEnv(value: string | undefined) {
  if (!value) return undefined;
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}

function createDbClient() {
  const url = cleanEnv(process.env.TURSO_DATABASE_URL) ?? "file:local.db";
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

  return createClient({
    url,
    authToken: authToken || undefined,
  });
}

const client = createDbClient();

export const db = drizzle(client, { schema });
export { client };
