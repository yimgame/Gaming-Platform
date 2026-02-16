import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
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

export const levelshotOverrides = pgTable("levelshot_overrides", {
  mapName: text("map_name").primaryKey(),
  imageUrl: text("image_url").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const statsMatches = pgTable("stats_matches", {
  matchId: text("match_id").primaryKey(),
  datetime: text("datetime").notNull(),
  playedAt: timestamp("played_at", { withTimezone: false }).notNull(),
  map: text("map").notNull(),
  type: text("type").notNull(),
  isTeamGame: boolean("is_team_game").notNull(),
  duration: integer("duration").notNull(),
  sourcePath: text("source_path"),
  importedAt: timestamp("imported_at", { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const statsTeams = pgTable(
  "stats_teams",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    matchId: text("match_id")
      .notNull()
      .references(() => statsMatches.matchId, { onDelete: "cascade" }),
    teamIndex: integer("team_index").notNull(),
    name: text("name").notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    matchTeamUnique: uniqueIndex("stats_teams_match_team_idx_uq").on(table.matchId, table.teamIndex),
  }),
);

export const statsPlayers = pgTable(
  "stats_players",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    matchId: text("match_id")
      .notNull()
      .references(() => statsMatches.matchId, { onDelete: "cascade" }),
    slotKey: text("slot_key").notNull(),
    teamIndex: integer("team_index"),
    playerIndex: integer("player_index").notNull(),
    name: text("name").notNull(),
    score: integer("score").notNull(),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    suicides: integer("suicides").notNull(),
    net: integer("net").notNull(),
    damageGiven: integer("damage_given").notNull(),
    damageTaken: integer("damage_taken").notNull(),
    teamDamage: integer("team_damage").notNull().default(0),
    teamKills: integer("team_kills").notNull().default(0),
    healthTotal: integer("health_total").notNull(),
    armorTotal: integer("armor_total").notNull(),
    ctfCaptures: integer("ctf_captures"),
    ctfAssists: integer("ctf_assists"),
    ctfDefense: integer("ctf_defense"),
    ctfReturns: integer("ctf_returns"),
    rawStats: jsonb("raw_stats").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    matchSlotUnique: uniqueIndex("stats_players_match_slot_uq").on(table.matchId, table.slotKey),
  }),
);

export const statsPlayerWeapons = pgTable("stats_player_weapons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id")
    .notNull()
    .references(() => statsPlayers.id, { onDelete: "cascade" }),
  weaponIndex: integer("weapon_index").notNull(),
  name: text("name").notNull(),
  hits: integer("hits").notNull(),
  shots: integer("shots").notNull(),
  kills: integer("kills").notNull(),
  accuracy: doublePrecision("accuracy"),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

export const statsPlayerItems = pgTable("stats_player_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id")
    .notNull()
    .references(() => statsPlayers.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  itemIndex: integer("item_index").notNull(),
  name: text("name").notNull(),
  pickups: integer("pickups").notNull(),
  time: integer("time"),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default("main"),
  siteName: text("site_name").notNull(),
  heroSubtitle: text("hero_subtitle").notNull(),
  heroDescription: text("hero_description").notNull(),
  aboutTitle: text("about_title").notNull(),
  aboutLines: text("about_lines").array().notNull(),
  contactTitle: text("contact_title").notNull(),
  contactSubtitle: text("contact_subtitle").notNull(),
  contactNameLabel: text("contact_name_label").notNull(),
  contactEmailLabel: text("contact_email_label").notNull(),
  contactMessageLabel: text("contact_message_label").notNull(),
  contactNamePlaceholder: text("contact_name_placeholder").notNull(),
  contactEmailPlaceholder: text("contact_email_placeholder").notNull(),
  contactMessagePlaceholder: text("contact_message_placeholder").notNull(),
  contactButtonLabel: text("contact_button_label").notNull(),
  contactSuccessTitle: text("contact_success_title").notNull(),
  contactSuccessDescription: text("contact_success_description").notNull(),
  contactDestination: text("contact_destination").notNull(),
  footerGithubUrl: text("footer_github_url").notNull(),
  footerDiscordUrl: text("footer_discord_url").notNull(),
  footerYoutubeUrl: text("footer_youtube_url").notNull(),
  footerEmail: text("footer_email").notNull(),
  footerCopyright: text("footer_copyright").notNull(),
  footerDevelopedBy: text("footer_developed_by").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).pick({
  name: true,
  email: true,
  message: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type MatchAsset = typeof matchAssets.$inferSelect;
export type LevelshotOverride = typeof levelshotOverrides.$inferSelect;
export type StatsMatch = typeof statsMatches.$inferSelect;
export type StatsTeam = typeof statsTeams.$inferSelect;
export type StatsPlayer = typeof statsPlayers.$inferSelect;
export type StatsPlayerWeapon = typeof statsPlayerWeapons.$inferSelect;
export type StatsPlayerItem = typeof statsPlayerItems.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
