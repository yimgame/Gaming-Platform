import type { MatchStats, PlayerStats, PlayerRanking, RankingFilters } from '../shared/stats-schema';
import { getAllMatches, getMatchesInDateRange } from './stats-parser';

/**
 * Calcula el ranking global de jugadores basado en los filtros
 */
export async function calculateGlobalRanking(filters: Partial<RankingFilters> = {}): Promise<PlayerRanking[]> {
  // Obtener partidas según filtros de fecha
  let matches: MatchStats[] = [];
  
  if (filters.startDate || filters.endDate) {
    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;
    matches = await getMatchesInDateRange(startDate, endDate);
  } else {
    matches = await getAllMatches();
  }
  
  // Filtrar por mapa
  if (filters.map) {
    matches = matches.filter(m => m.map === filters.map);
  }
  
  // Filtrar por tipo de juego
  if (filters.gameType) {
    matches = matches.filter(m => m.type === filters.gameType);
  }
  
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
  const matches = await getAllMatches();
  
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
