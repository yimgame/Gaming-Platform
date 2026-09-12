import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./server/database-url";

const resolvedDb = resolveDatabaseUrl(process.env.DATABASE_URL);

if (resolvedDb.usedHostFallback) {
  console.warn("drizzle-kit: DATABASE_URL host 'db' detected outside Docker. Using localhost fallback.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: resolvedDb.url,
  },
});
