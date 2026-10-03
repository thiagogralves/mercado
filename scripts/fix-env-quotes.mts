import fs from "fs";

const path = ".env.local";
let text = fs.readFileSync(path, "utf8");
const before = text;
text = text.replace(
  /^(TURSO_DATABASE_URL|TURSO_AUTH_TOKEN|GEMINI_API_KEY|GEMINI_MODEL)=(["'])(.+)\2\s*$/gm,
  "$1=$3",
);
fs.writeFileSync(path, text);
console.log(
  JSON.stringify({
    changed: before !== text,
    turso_url_ok: /^TURSO_DATABASE_URL=libsql:\/\//m.test(text),
  }),
);
