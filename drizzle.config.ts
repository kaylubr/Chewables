import { defineConfig } from "drizzle-kit";
import { config } from "./src/core/config";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/core/db/index.ts",
	out: "./migrations",
	dbCredentials: {
		url: config.databaseUrl,
	},
});