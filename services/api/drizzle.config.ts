import { defineConfig } from "drizzle-kit";

// Shared Supabase project rule (agent-rules/06-shared-supabase.md): Roam owns
// the `roam_poc` schema. `roam_poc_backend` role is added in Sub-6.
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  schemaFilter: ["roam_poc"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
