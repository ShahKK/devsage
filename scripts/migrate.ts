/**
 * Applies sql/schema.sql to the database in DATABASE_URL.
 * Usage: npm run db:migrate
 *
 * Loaded with: node --env-file=.env.local --experimental-strip-types scripts/migrate.ts
 * (Node 22+ runs TypeScript directly via --experimental-strip-types.)
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  const sql = neon(url);
  const schema = readFileSync(join(__dirname, "..", "sql", "schema.sql"), "utf8");

  // Split on semicolons at end-of-statement; run each separately because the
  // Neon HTTP driver executes one statement per call.
  const statements = schema
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    process.stdout.write(`-> ${statement.split("\n")[0].slice(0, 70)}...\n`);
    await sql.query(statement);
  }

  console.log("\n✅ Migration complete.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
