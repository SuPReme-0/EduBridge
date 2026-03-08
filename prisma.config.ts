// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // ADD THIS LINE for Prisma 7 Seed Support:
    seed: "npx tsx prisma/seeds/index.ts", 
  },
  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
});