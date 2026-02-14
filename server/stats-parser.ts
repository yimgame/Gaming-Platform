import { parseStringPromise } from 'xml2js';
import fs from 'fs/promises';
import path from 'path';
import type { MatchStats, PlayerStats, TeamStats, WeaponStats, ItemStats } from '../shared/stats-schema';

// Ruta base para las estadísticas de CPMA
// En producción (Docker): usa variable de entorno STATS_PATH
// En desarrollo (local): usa ruta de Windows
const STATS_BASE_PATH = process.env.STATS_PATH || 'G:\\Games\\Quake3\\cpma\\stats';

/**
 * Parse un archivo XML de estadísticas de CPMA
 */
export async function parseMatchXML(xmlPath: string): Promise<MatchStats> {
  const xmlContent = await fs.readFile(xmlPath, 'utf-8');
  const result = await parseStringPromise(xmlContent);
  
  const match = result.match.$;
  const isTeamGame = match.isTeamGame === 'true';
  
  let teams: TeamStats[] = [];
  let players: PlayerStats[] = [];
  
  if (isTeamGame && result.match.team) {
    teams = result.match.team.map((team: any) => parseTeam(team));
  } else if (result.match.player) {
    players = result.match.player.map((player: any) => parsePlayer(player));
  }
  
  return {
    id: match.id,
    datetime: match.datetime,
    map: match.map,
    type: match.type,
    isTeamGame,
    duration: parseInt(match.duration),
    teams: teams.length > 0 ? teams : undefined,
    players: players.length > 0 ? players : undefined,
  };
}

/**
 * Parse un equipo del XML
 */
function parseTeam(teamData: any): TeamStats {
  const team = teamData.$;
  const players = teamData.player?.map((player: any) => parsePlayer(player)) || [];
  
  return {
    name: team.name || '',
    score: parseInt(team.score) || 0,
    players,
  };
}

/**
 * Parse un jugador del XML
 */
function parsePlayer(playerData: any): PlayerStats {
  const player = playerData;
  const stats = player.stat?.reduce((acc: any, stat: any) => {
    acc[stat.$.name] = stat.$.value;
    return acc;
  }, {}) || {};
  
  const weapons: WeaponStats[] = player.weapons?.[0]?.weapon?.map((weapon: any) => ({
    name: weapon.$.name,
    hits: parseInt(weapon.$.hits) || 0,
    shots: parseInt(weapon.$.shots) || 0,
    kills: parseInt(weapon.$.kills) || 0,
    accuracy: weapon.$.shots > 0 ? (parseInt(weapon.$.hits) / parseInt(weapon.$.shots)) * 100 : 0,
  })) || [];
  
  const items: ItemStats[] = player.items?.[0]?.item?.map((item: any) => ({
    name: item.$.name,
    pickups: parseInt(item.$.pickups) || 0,
  })) || [];
  
  const powerups: ItemStats[] = player.powerups?.[0]?.item?.map((item: any) => ({
    name: item.$.name,
    pickups: parseInt(item.$.pickups) || 0,
    time: parseInt(item.$.time) || 0,
  })) || [];
  
  const ctfStats = player.CTF?.[0]?.stat?.reduce((acc: any, stat: any) => {
    acc[stat.$.name.toLowerCase()] = parseInt(stat.$.value) || 0;
    return acc;
  }, {});
  
  return {
    name: player.$.name,
    score: parseInt(stats.Score) || 0,
    kills: parseInt(stats.Kills) || 0,
    deaths: parseInt(stats.Deaths) || 0,
    suicides: parseInt(stats.Suicides) || 0,
    net: parseInt(stats.Net) || 0,
    damageGiven: parseInt(stats.DamageGiven) || 0,
    damageTaken: parseInt(stats.DamageTaken) || 0,
    healthTotal: parseInt(stats.HealthTotal) || 0,
    armorTotal: parseInt(stats.ArmorTotal) || 0,
    weapons,
    items,
    powerups,
    ctf: ctfStats ? {
      captures: ctfStats.captures || 0,
      assists: ctfStats.assists || 0,
      defense: ctfStats.defense || 0,
      returns: ctfStats.returns || 0,
    } : undefined,
  };
}

/**
 * Obtiene todas las partidas en un rango de fechas
 */
export async function getMatchesInDateRange(startDate?: Date, endDate?: Date): Promise<MatchStats[]> {
  const matches: MatchStats[] = [];
  
  try {
    // Recorrer años
    const years = await fs.readdir(STATS_BASE_PATH);
    
    for (const year of years) {
      const yearPath = path.join(STATS_BASE_PATH, year);
      const yearStat = await fs.stat(yearPath);
      
      if (!yearStat.isDirectory()) continue;
      
      // Recorrer meses
      const months = await fs.readdir(yearPath);
      
      for (const month of months) {
        const monthPath = path.join(yearPath, month);
        const monthStat = await fs.stat(monthPath);
        
        if (!monthStat.isDirectory()) continue;
        
        // Recorrer días
        const days = await fs.readdir(monthPath);
        
        for (const day of days) {
          const dayPath = path.join(monthPath, day);
          const dayStat = await fs.stat(dayPath);
          
          if (!dayStat.isDirectory()) continue;
          
          // Verificar si está en el rango de fechas
          const currentDate = new Date(`${year}-${month}-${day}`);
          if (startDate && currentDate < startDate) continue;
          if (endDate && currentDate > endDate) continue;
          
          // Leer archivos XML del día
          const files = await fs.readdir(dayPath);
          
          for (const file of files) {
            if (file.endsWith('.xml')) {
              const filePath = path.join(dayPath, file);
              try {
                const match = await parseMatchXML(filePath);
                matches.push(match);
              } catch (err) {
                console.error(`Error parsing ${filePath}:`, err);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading stats directory:', err);
  }
  
  return matches;
}

/**
 * Obtiene las partidas de un día específico
 */
export async function getMatchesByDate(year: string, month: string, day: string): Promise<MatchStats[]> {
  const matches: MatchStats[] = [];
  const dayPath = path.join(STATS_BASE_PATH, year, month, day);
  
  try {
    const files = await fs.readdir(dayPath);
    
    for (const file of files) {
      if (file.endsWith('.xml')) {
        const filePath = path.join(dayPath, file);
        try {
          const match = await parseMatchXML(filePath);
          matches.push(match);
        } catch (err) {
          console.error(`Error parsing ${filePath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error reading day directory:', err);
  }
  
  return matches;
}

/**
 * Obtiene todas las partidas disponibles
 */
export async function getAllMatches(): Promise<MatchStats[]> {
  return getMatchesInDateRange();
}
