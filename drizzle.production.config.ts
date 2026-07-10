import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle-production",
  dialect: "mysql",
  dbCredentials: {
    // Generation does not connect; Railway supplies the real URL for migrate.
    url: process.env.DATABASE_URL ?? "mysql://root:root@127.0.0.1:3306/trustcare",
  },
});
