import { parseStringPromise } from 'xml2js';
import fs from 'fs/promises';
import path from 'path';
import type { MatchStats, PlayerStats, TeamStats, WeaponStats, ItemStats } from '../shared/stats-schema';
import { STATS_BASE_PATH, STATS_SOURCES, type StatsSource } from './config';

function resolveMatchId(xmlPath: string, basePath: string, sourceTag: string, attrs?: Record<string, string>): string {
  const xmlId = attrs?.id?.toString();
  if (xmlId && xmlId !== '0') {
    return xmlId;
  }

  const relativePath = path.relative(basePath, xmlPath);
  const normalizedPath = relativePath && !relativePath.startsWith('..')
    ? relativePath
    : path.basename(xmlPath);
  const withoutExtension = normalizedPath.replace(/\.xml$/i, '');
  const fallback = withoutExtension.replace(/[\\/]/g, '-') || path.basename(xmlPath, path.extname(xmlPath));

  // "legacy" es la carpeta compartida de siempre -- miles de partidas ya
  // están en la DB con el id SIN prefijo (formato viejo, ej. "2026-02-13-...").
  // No le agregamos prefijo para no duplicarlas: el upsert las va a
  // encontrar por el mismo id y actualizarlas en vez de crear una fila nueva.
  if (sourceTag === 'legacy') {
    return fallback;
  }

  // Para las fuentes nuevas (una por instancia aislada) sí prefijamos con el
  // origen, para que dos servers distintos no generen el mismo id si
  // jugaron una partida justo a la misma hora (CPMA siempre manda id="0",
  // así que el id real sale de acá).
  return `${sourceTag}-${fallback}`;
}

/**
 * Parse un archivo XML de estadísticas de CPMA
 */
export async function parseMatchXML(
  xmlPath: string,
  basePath: string = STATS_BASE_PATH,
  sourceTag: string = 'legacy',
): Promise<MatchStats> {
  const xmlContent = await fs.readFile(xmlPath, 'utf-8');
  const result = await parseStringPromise(xmlContent);

  const match = result.match.$;
  const matchId = resolveMatchId(xmlPath, basePath, sourceTag, match);
  const isTeamGame = match.isTeamGame === 'true';

  let teams: TeamStats[] = [];
  let players: PlayerStats[] = [];

  if (isTeamGame && result.match.team) {
    teams = result.match.team.map((team: any) => parseTeam(team));
  } else if (result.match.player) {
    players = result.match.player.map((player: any) => parsePlayer(player));
  }

  return {
    id: matchId,
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
  const numericStats = Object.entries(stats).reduce<Record<string, number>>((acc, [key, value]) => {
    const parsedValue = parseInt(String(value), 10);
    acc[key] = Number.isNaN(parsedValue) ? 0 : parsedValue;
    return acc;
  }, {});

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
    teamDamage: parseInt(stats.TeamDamage) || 0,
    teamKills: parseInt(stats.TeamKills) || 0,
    healthTotal: parseInt(stats.HealthTotal) || 0,
    armorTotal: parseInt(stats.ArmorTotal) || 0,
    rawStats: numericStats,
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
 * Recorre el árbol año/mes/día de UNA fuente de stats y devuelve las
 * partidas que caen dentro del rango de fechas pedido.
 */
async function getMatchesInDateRangeForSource(
  source: StatsSource,
  startDate?: Date,
  endDate?: Date,
): Promise<MatchStats[]> {
  const matches: MatchStats[] = [];

  const years = await fs.readdir(source.path);

  for (const year of years) {
    const yearPath = path.join(source.path, year);
    const yearStat = await fs.stat(yearPath);

    if (!yearStat.isDirectory()) continue;

    const months = await fs.readdir(yearPath);

    for (const month of months) {
      const monthPath = path.join(yearPath, month);
      const monthStat = await fs.stat(monthPath);

      if (!monthStat.isDirectory()) continue;

      const days = await fs.readdir(monthPath);

      for (const day of days) {
        const dayPath = path.join(monthPath, day);
        const dayStat = await fs.stat(dayPath);

        if (!dayStat.isDirectory()) continue;

        const currentDate = new Date(`${year}-${month}-${day}`);
        if (startDate && currentDate < startDate) continue;
        if (endDate && currentDate > endDate) continue;

        const files = await fs.readdir(dayPath);

        for (const file of files) {
          if (file.endsWith('.xml')) {
            const filePath = path.join(dayPath, file);
            try {
              const match = await parseMatchXML(filePath, source.path, source.tag);
              matches.push(match);
            } catch (err) {
              console.error(`Error parsing ${filePath}:`, err);
            }
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Obtiene todas las partidas en un rango de fechas, recorriendo TODAS las
 * fuentes conocidas (la carpeta compartida histórica + una por cada
 * instancia/server aislado bajo Quake3/instances).
 */
export async function getMatchesInDateRange(startDate?: Date, endDate?: Date): Promise<MatchStats[]> {
  const matches: MatchStats[] = [];

  for (const source of STATS_SOURCES) {
    try {
      const sourceMatches = await getMatchesInDateRangeForSource(source, startDate, endDate);
      matches.push(...sourceMatches);
    } catch (err) {
      // Una fuente puede no tener partidas todavía (server nunca jugado) --
      // no es un error real, seguimos con las demás.
      console.error(`Error reading stats directory (${source.tag}: ${source.path}):`, err);
    }
  }

  return matches;
}

/**
 * Obtiene las partidas de un día específico, en todas las fuentes conocidas.
 */
export async function getMatchesByDate(year: string, month: string, day: string): Promise<MatchStats[]> {
  const matches: MatchStats[] = [];

  for (const source of STATS_SOURCES) {
    const dayPath = path.join(source.path, year, month, day);

    try {
      const files = await fs.readdir(dayPath);

      for (const file of files) {
        if (file.endsWith('.xml')) {
          const filePath = path.join(dayPath, file);
          try {
            const match = await parseMatchXML(filePath, source.path, source.tag);
            matches.push(match);
          } catch (err) {
            console.error(`Error parsing ${filePath}:`, err);
          }
        }
      }
    } catch (err) {
      // Esa fuente puede no tener partidas ese día en particular -- normal.
    }
  }

  return matches;
}

/**
 * Obtiene todas las partidas disponibles
 */
export async function getAllMatches(): Promise<MatchStats[]> {
  return getMatchesInDateRange();
}
