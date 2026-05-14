import { defineConfig } from "drizzle-kit";

// Shared Supabase project rule (agent-rules/06-shared-supabase.md): Roam owns
// the `roam_poc` schema. Connects via the `roam_poc_backend` role (ROA-94) —
// its search_path is locked server-side so the bare schemaFilter is enough.
// tablesFilter hides Supabase auth/storage scaffolding from generated diffs.
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  schemaFilter: ["roam_poc"],
  tablesFilter: ["!supabase_*"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
