import { defineConfig } from "drizzle-kit";
import "dotenv/config";

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

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: cleanEnv(process.env.TURSO_DATABASE_URL) ?? "file:local.db",
    authToken: cleanEnv(process.env.TURSO_AUTH_TOKEN),
  },
});
