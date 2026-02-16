import { z } from "zod";

// Schema para armas
export const WeaponStatsSchema = z.object({
  name: z.string(),
  hits: z.number(),
  shots: z.number(),
  kills: z.number(),
  accuracy: z.number().optional(),
});

// Schema para items
export const ItemStatsSchema = z.object({
  name: z.string(),
  pickups: z.number(),
  time: z.number().optional(), // tiempo con el item (en ms)
});

// Schema para stats CTF
export const CTFStatsSchema = z.object({
  captures: z.number(),
  assists: z.number(),
  defense: z.number(),
  returns: z.number(),
});

// Schema para un jugador
export const PlayerStatsSchema = z.object({
  name: z.string(),
  score: z.number(),
  kills: z.number(),
  deaths: z.number(),
  suicides: z.number(),
  net: z.number(),
  damageGiven: z.number(),
  damageTaken: z.number(),
  teamDamage: z.number().optional(),
  teamKills: z.number().optional(),
  healthTotal: z.number(),
  armorTotal: z.number(),
  rawStats: z.record(z.string(), z.number()).optional(),
  weapons: z.array(WeaponStatsSchema),
  items: z.array(ItemStatsSchema),
  powerups: z.array(ItemStatsSchema),
  ctf: CTFStatsSchema.optional(),
  team: z.string().optional(),
});

// Schema para un equipo
export const TeamStatsSchema = z.object({
  name: z.string(),
  score: z.number(),
  players: z.array(PlayerStatsSchema),
});

// Schema para una partida completa
export const MatchStatsSchema = z.object({
  id: z.string(),
  datetime: z.string(),
  map: z.string(),
  type: z.string(),
  isTeamGame: z.boolean(),
  duration: z.number(), // en segundos
  teams: z.array(TeamStatsSchema).optional(),
  players: z.array(PlayerStatsSchema).optional(),
});

// Schema para rankings
export const PlayerRankingSchema = z.object({
  rank: z.number(),
  name: z.string(),
  totalScore: z.number(),
  totalKills: z.number(),
  totalDeaths: z.number(),
  totalMatches: z.number(),
  kdRatio: z.number(),
  avgScore: z.number(),
  totalDamageGiven: z.number(),
  totalDamageTaken: z.number(),
  captures: z.number().optional(),
  defenses: z.number().optional(),
  returns: z.number().optional(),
  gameTypes: z.array(z.string()).optional(), // Tipos de juego jugados
});

// Schema para filtros de ranking
export const RankingFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  map: z.string().optional(),
  gameType: z.string().optional(),
  minMatches: z.number().optional().default(1),
  sortBy: z.enum(['score', 'kills', 'kdRatio', 'captures', 'defenses']).optional().default('score'),
});

// Types exportados
export type WeaponStats = z.infer<typeof WeaponStatsSchema>;
export type ItemStats = z.infer<typeof ItemStatsSchema>;
export type CTFStats = z.infer<typeof CTFStatsSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
export type TeamStats = z.infer<typeof TeamStatsSchema>;
export type MatchStats = z.infer<typeof MatchStatsSchema>;
export type PlayerRanking = z.infer<typeof PlayerRankingSchema>;
export type RankingFilters = z.infer<typeof RankingFiltersSchema>;

// Estado del servidor Quake 3 en tiempo real
export interface QuakePlayer {
  score: number;
  ping: number;
  name: string;
}

export interface QuakeServerStatus {
  online: boolean;
  hostname?: string;
  mapname?: string;
  gametype?: string;
  maxClients?: number;
  clients?: number;
  players?: QuakePlayer[];
  version?: string;
  protocol?: number;
  error?: string;
  lastUpdate?: Date;
}
