import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const matchAssets = pgTable("match_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: text("match_id").notNull(),
  kind: text("kind").notNull(),
  filename: text("filename").notNull(),
  sourcePath: text("source_path"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type MatchAsset = typeof matchAssets.$inferSelect;
