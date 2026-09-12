import type { MatchStats, PlayerStats, PlayerRanking, RankingFilters } from '../shared/stats-schema';
import { getAllMatches, getMatchesInDateRange } from './stats-parser';
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { statsMatches, statsPlayers } from "../shared/schema";
import {
  getMatchesFromStatsDb,
  getServerStatsFromDb,
  getStatsMatchesCount,
  isMissingStatsTablesError,
  syncMatchesToStatsDb,
  triggerStatsAutoSyncInBackground,
} from './match-stats-db-service';

let initialSyncPromise: Promise<void> | null = null;

async function ensureStatsSeededInDb() {
  if (initialSyncPromise) {
    await initialSyncPromise;
    return;
  }

  initialSyncPromise = (async () => {
    const existingCount = await getStatsMatchesCount();
    if (existingCount > 0) return;

    const parsedMatches = await getAllMatches();
    if (parsedMatches.length === 0) return;

    await syncMatchesToStatsDb(parsedMatches);
  })();

  try {
    await initialSyncPromise;
  } finally {
    initialSyncPromise = null;
  }
}

async function getMatchesForStats(filters: Partial<RankingFilters> = {}): Promise<MatchStats[]> {
  try {
    await ensureStatsSeededInDb();
    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

    let matches = await getMatchesFromStatsDb({
      startDate,
      endDate,
      map: filters.map,
      gameType: filters.gameType,
    });

    triggerStatsAutoSyncInBackground();

    return matches;
  } catch (error) {
    if (!isMissingStatsTablesError(error)) {
      console.error("Error loading stats from DB. Using XML fallback:", error);
    }

    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
      const endDate = filters.endDate ? new Date(filters.endDate) : undefined;
      let matches = await getMatchesInDateRange(startDate, endDate);

      if (filters.map) {
        matches = matches.filter(m => m.map === filters.map);
      }

      if (filters.gameType) {
        matches = matches.filter(m => m.type === filters.gameType);
      }

      return matches;
    }

    let matches = await getAllMatches();
    if (filters.map) {
      matches = matches.filter(m => m.map === filters.map);
    }
    if (filters.gameType) {
      matches = matches.filter(m => m.type === filters.gameType);
    }
    return matches;
  }
}

type RankingAggRow = {
  name: string;
  totalScore: number | string;
  totalKills: number | string;
  totalDeaths: number | string;
  totalMatches: number | string;
  totalDamageGiven: number | string;
  totalDamageTaken: number | string;
  captures: number | string;
  defenses: number | string;
  returns: number | string;
  gameTypes: string[] | null;
};

async function calculateGlobalRankingFromDb(filters: Partial<RankingFilters> = {}): Promise<PlayerRanking[]> {
  const whereClauses = [];
  if (filters.startDate) {
    whereClauses.push(gte(statsMatches.playedAt, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    whereClauses.push(lte(statsMatches.playedAt, new Date(filters.endDate)));
  }
  if (filters.map) {
    whereClauses.push(eq(statsMatches.map, filters.map));
  }
  if (filters.gameType) {
    whereClauses.push(eq(statsMatches.type, filters.gameType));
  }

  const whereCondition =
    whereClauses.length > 1
      ? and(...whereClauses)
      : whereClauses.length === 1
        ? whereClauses[0]
        : undefined;

  const rows = await db
    .select({
      name: statsPlayers.name,
      totalScore: sql<number>`coalesce(sum(${statsPlayers.score}), 0)`,
      totalKills: sql<number>`coalesce(sum(${statsPlayers.kills}), 0)`,
      totalDeaths: sql<number>`coalesce(sum(${statsPlayers.deaths}), 0)`,
      totalMatches: sql<number>`count(*)`,
      totalDamageGiven: sql<number>`coalesce(sum(${statsPlayers.damageGiven}), 0)`,
      totalDamageTaken: sql<number>`coalesce(sum(${statsPlayers.damageTaken}), 0)`,
      captures: sql<number>`coalesce(sum(coalesce(${statsPlayers.ctfCaptures}, 0)), 0)`,
      defenses: sql<number>`coalesce(sum(coalesce(${statsPlayers.ctfDefense}, 0)), 0)`,
      returns: sql<number>`coalesce(sum(coalesce(${statsPlayers.ctfReturns}, 0)), 0)`,
      gameTypes: sql<string[]>`array_remove(array_agg(distinct ${statsMatches.type}), null)`,
    })
    .from(statsPlayers)
    .innerJoin(statsMatches, eq(statsPlayers.matchId, statsMatches.matchId))
    .where(whereCondition)
    .groupBy(statsPlayers.name);

  const minMatches = filters.minMatches || 1;
  const rankings: PlayerRanking[] = (rows as RankingAggRow[])
    .map((row) => {
      const totalScore = Number(row.totalScore) || 0;
      const totalKills = Number(row.totalKills) || 0;
      const totalDeaths = Number(row.totalDeaths) || 0;
      const totalMatches = Number(row.totalMatches) || 0;
      const totalDamageGiven = Number(row.totalDamageGiven) || 0;
      const totalDamageTaken = Number(row.totalDamageTaken) || 0;
      const captures = Number(row.captures) || 0;
      const defenses = Number(row.defenses) || 0;
      const returns = Number(row.returns) || 0;

      return {
        rank: 0,
        name: row.name,
        totalScore,
        totalKills,
        totalDeaths,
        totalMatches,
        kdRatio: totalDeaths > 0 ? totalKills / totalDeaths : totalKills,
        avgScore: totalMatches > 0 ? totalScore / totalMatches : 0,
        totalDamageGiven,
        totalDamageTaken,
        captures,
        defenses,
        returns,
        gameTypes: row.gameTypes || [],
      };
    })
    .filter((row) => row.totalMatches >= minMatches);

  const sortBy = filters.sortBy || 'score';
  rankings.sort((a, b) => {
    switch (sortBy) {
      case 'kills':
        return b.totalKills - a.totalKills;
      case 'kdRatio':
        return b.kdRatio - a.kdRatio;
      case 'captures':
        return (b.captures || 0) - (a.captures || 0);
      case 'defenses':
        return (b.defenses || 0) - (a.defenses || 0);
      case 'score':
      default:
        return b.totalScore - a.totalScore;
    }
  });

  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings;
}

/**
 * Calcula el ranking global de jugadores basado en los filtros
 */
export async function calculateGlobalRanking(filters: Partial<RankingFilters> = {}): Promise<PlayerRanking[]> {
  try {
    await ensureStatsSeededInDb();
    triggerStatsAutoSyncInBackground();
    return await calculateGlobalRankingFromDb(filters);
  } catch (error) {
    if (!isMissingStatsTablesError(error)) {
      console.error("Error calculating DB ranking, using fallback in-memory:", error);
    }
  }

  const matches = await getMatchesForStats(filters);
  
  // Agregar estadísticas por jugador
  const playerStatsMap = new Map<string, {
    totalScore: number;
    totalKills: number;
    totalDeaths: number;
    totalMatches: number;
    totalDamageGiven: number;
    totalDamageTaken: number;
    captures: number;
    defenses: number;
    returns: number;
    gameTypes: Set<string>;
  }>();
  
  for (const match of matches) {
    const players: PlayerStats[] = [];
    
    if (match.teams) {
      // Partida por equipos
      for (const team of match.teams) {
        players.push(...team.players);
      }
    } else if (match.players) {
      // Partida FFA
      players.push(...match.players);
    }
    
    for (const player of players) {
      const existing = playerStatsMap.get(player.name) || {
        totalScore: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalMatches: 0,
        totalDamageGiven: 0,
        totalDamageTaken: 0,
        captures: 0,
        defenses: 0,
        returns: 0,
        gameTypes: new Set<string>(),
      };
      
      existing.totalScore += player.score;
      existing.totalKills += player.kills;
      existing.totalDeaths += player.deaths;
      existing.totalMatches += 1;
      existing.totalDamageGiven += player.damageGiven;
      existing.totalDamageTaken += player.damageTaken;
      existing.gameTypes.add(match.type);
      
      if (player.ctf) {
        existing.captures += player.ctf.captures;
        existing.defenses += player.ctf.defense;
        existing.returns += player.ctf.returns;
      }
      
      playerStatsMap.set(player.name, existing);
    }
  }
  
  // Filtrar por mínimo de partidas
  const minMatches = filters.minMatches || 1;
  const filteredPlayers = Array.from(playerStatsMap.entries())
    .filter(([_, stats]) => stats.totalMatches >= minMatches);
  
  // Convertir a ranking
  const rankings: PlayerRanking[] = filteredPlayers.map(([name, stats]) => ({
    rank: 0, // se asignará después del ordenamiento
    name,
    totalScore: stats.totalScore,
    totalKills: stats.totalKills,
    totalDeaths: stats.totalDeaths,
    totalMatches: stats.totalMatches,
    kdRatio: stats.totalDeaths > 0 ? stats.totalKills / stats.totalDeaths : stats.totalKills,
    avgScore: stats.totalScore / stats.totalMatches,
    totalDamageGiven: stats.totalDamageGiven,
    totalDamageTaken: stats.totalDamageTaken,
    captures: stats.captures,
    defenses: stats.defenses,
    returns: stats.returns,
    gameTypes: Array.from(stats.gameTypes),
  }));
  
  // Ordenar según el criterio
  const sortBy = filters.sortBy || 'score';
  rankings.sort((a, b) => {
    switch (sortBy) {
      case 'kills':
        return b.totalKills - a.totalKills;
      case 'kdRatio':
        return b.kdRatio - a.kdRatio;
      case 'captures':
        return (b.captures || 0) - (a.captures || 0);
      case 'defenses':
        return (b.defenses || 0) - (a.defenses || 0);
      case 'score':
      default:
        return b.totalScore - a.totalScore;
    }
  });
  
  // Asignar rankings
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });
  
  return rankings;
}

/**
 * Obtiene el ranking de una partida específica
 */
export function getMatchRanking(match: MatchStats): PlayerRanking[] {
  const players: PlayerStats[] = [];
  
  if (match.teams) {
    for (const team of match.teams) {
      players.push(...team.players);
    }
  } else if (match.players) {
    players.push(...match.players);
  }
  
  const rankings: PlayerRanking[] = players.map(player => ({
    rank: 0,
    name: player.name,
    totalScore: player.score,
    totalKills: player.kills,
    totalDeaths: player.deaths,
    totalMatches: 1,
    kdRatio: player.deaths > 0 ? player.kills / player.deaths : player.kills,
    avgScore: player.score,
    totalDamageGiven: player.damageGiven,
    totalDamageTaken: player.damageTaken,
    captures: player.ctf?.captures,
    defenses: player.ctf?.defense,
    returns: player.ctf?.returns,
  }));
  
  // Ordenar por score
  rankings.sort((a, b) => b.totalScore - a.totalScore);
  
  // Asignar rankings
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });
  
  return rankings;
}

/**
 * Obtiene estadísticas generales del servidor
 */
export async function getServerStats() {
  // Camino rápido: agregación directa en SQL contra la DB. Con ~25000
  // partidas (antes de aislar los homepaths eran ~1000), armar esto trayendo
  // cada partida completa con jugadores/armas/items (el camino de abajo)
  // tardaba decenas de segundos -- por eso las tarjetas de stats quedaban
  // en loading. Si la DB no tiene las tablas todavía, cae al camino viejo.
  try {
    const aggregate = await getServerStatsFromDb();
    if (aggregate.totalMatches > 0) {
      return aggregate;
    }
  } catch (error) {
    if (!isMissingStatsTablesError(error)) {
      console.error("Error calculando stats agregadas desde la DB, usando fallback:", error);
    }
  }

  const matches = await getMatchesForStats();

  const playerNames = new Set<string>();
  let totalKills = 0;
  let totalDeaths = 0;
  let totalDamage = 0;
  const mapCounts = new Map<string, number>();
  const gameTypeCounts = new Map<string, number>();
  
  for (const match of matches) {
    const players: PlayerStats[] = [];
    
    if (match.teams) {
      for (const team of match.teams) {
        players.push(...team.players);
      }
    } else if (match.players) {
      players.push(...match.players);
    }
    
    for (const player of players) {
      playerNames.add(player.name);
      totalKills += player.kills;
      totalDeaths += player.deaths;
      totalDamage += player.damageGiven;
    }
    
    mapCounts.set(match.map, (mapCounts.get(match.map) || 0) + 1);
    gameTypeCounts.set(match.type, (gameTypeCounts.get(match.type) || 0) + 1);
  }
  
  return {
    totalMatches: matches.length,
    totalPlayers: playerNames.size,
    totalKills,
    totalDeaths,
    totalDamage,
    maps: Array.from(mapCounts.entries()).map(([map, count]) => ({ map, count }))
      .sort((a, b) => b.count - a.count),
    gameTypes: Array.from(gameTypeCounts.entries()).map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Obtiene los mejores jugadores por categoría
 */
export async function getTopPlayers(limit: number = 10) {
  const globalRanking = await calculateGlobalRanking();
  
  return {
    topByScore: globalRanking.slice(0, limit),
    topByKills: [...globalRanking].sort((a, b) => b.totalKills - a.totalKills).slice(0, limit),
    topByKD: [...globalRanking].sort((a, b) => b.kdRatio - a.kdRatio).slice(0, limit),
    topByCaptures: [...globalRanking]
      .filter(p => p.captures && p.captures > 0)
      .sort((a, b) => (b.captures || 0) - (a.captures || 0))
      .slice(0, limit),
  };
}

