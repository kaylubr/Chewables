import { defineConfig } from "drizzle-kit";
import { config } from "./src/core/config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: config.databaseUrl,
  },
});
