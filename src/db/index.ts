import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createDbClient() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  return createClient({
    url,
    authToken: authToken || undefined,
  });
}

const client = createDbClient();

export const db = drizzle(client, { schema });
export { client };
