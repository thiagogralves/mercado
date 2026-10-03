import { createClient } from "@libsql/client";
import fs from "fs";

function parseEnv(path: string) {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

async function counts(client: ReturnType<typeof createClient>, label: string) {
  const tables = [
    "products",
    "stores",
    "purchases",
    "purchase_items",
    "monthly_quotas",
    "product_aliases",
  ];
  const out: Record<string, string | number> = { label };
  for (const t of tables) {
    try {
      const r = await client.execute(`select count(*) as n from ${t}`);
      out[t] = Number(r.rows[0].n);
    } catch (e) {
      out[t] = `missing`;
    }
  }
  console.log(JSON.stringify(out));
}

const env = parseEnv(".env.local");
const raw = fs.readFileSync(".env.local", "utf8");
console.log(
  JSON.stringify({
    url_ok: Boolean(env.TURSO_DATABASE_URL?.startsWith("libsql")),
    file_had_quotes: /TURSO_DATABASE_URL=["']/.test(raw),
    token_set: Boolean(env.TURSO_AUTH_TOKEN),
  }),
);

const local = createClient({ url: "file:local.db" });
await counts(local, "local_db");

const remote = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});
await counts(remote, "turso_remote");
