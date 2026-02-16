import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { MatchStats, PlayerStats, TeamStats } from "../shared/stats-schema";
import {
  statsMatches,
  statsPlayerItems,
  statsPlayers,
  statsPlayerWeapons,
  statsTeams,
} from "../shared/schema";
import { db } from "./db";
import { getAllMatches } from "./stats-parser";

const DEFAULT_AUTO_SYNC_INTERVAL_MS = 10000;
let lastAutoSyncAt = 0;
let autoSyncInFlight: Promise<{ imported: number; skipped: boolean }> | null = null;

function parseMatchDatetime(matchDatetime: string): Date {
  const parts = matchDatetime.split(" ");
  if (parts.length < 2) {
    throw new Error(`Invalid match datetime: ${matchDatetime}`);
  }

  const dateParts = parts[0].split("/");
  const timeParts = parts[1].split(":");

  if (dateParts.length < 3 || timeParts.length < 2) {
    throw new Error(`Invalid match datetime: ${matchDatetime}`);
  }

  let day: number;
  let month: number;
  let year: number;

  if (dateParts[0].length === 4) {
    year = parseInt(dateParts[0], 10);
    month = parseInt(dateParts[1], 10);
    day = parseInt(dateParts[2], 10);
  } else {
    day = parseInt(dateParts[0], 10);
    month = parseInt(dateParts[1], 10);
    year = 2000 + parseInt(dateParts[2], 10);
  }

  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

  return new Date(year, month - 1, day, hour, minute, second);
}

const getPgErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

export const isMissingStatsTablesError = (error: unknown) => getPgErrorCode(error) === "42P01";

async function insertPlayerChildren(playerId: string, player: PlayerStats) {
  if (player.weapons.length > 0) {
    await db.insert(statsPlayerWeapons).values(
      player.weapons.map((weapon, index) => ({
        playerId,
        weaponIndex: index,
        name: weapon.name,
        hits: weapon.hits,
        shots: weapon.shots,
        kills: weapon.kills,
        accuracy: weapon.accuracy ?? null,
      })),
    );
  }

  const itemRows = [
    ...player.items.map((item, index) => ({
      playerId,
      category: "item",
      itemIndex: index,
      name: item.name,
      pickups: item.pickups,
      time: item.time ?? null,
    })),
    ...player.powerups.map((item, index) => ({
      playerId,
      category: "powerup",
      itemIndex: index,
      name: item.name,
      pickups: item.pickups,
      time: item.time ?? null,
    })),
  ];

  if (itemRows.length > 0) {
    await db.insert(statsPlayerItems).values(itemRows);
  }
}

export async function upsertMatchToStatsDb(match: MatchStats, sourcePath?: string): Promise<void> {
  const playedAt = parseMatchDatetime(match.datetime);

  await db.transaction(async (tx) => {
    await tx.delete(statsMatches).where(eq(statsMatches.matchId, match.id));

    await tx.insert(statsMatches).values({
      matchId: match.id,
      datetime: match.datetime,
      playedAt,
      map: match.map,
      type: match.type,
      isTeamGame: match.isTeamGame,
      duration: match.duration,
      sourcePath: sourcePath ?? null,
    });

    if (match.teams && match.teams.length > 0) {
      for (let teamIndex = 0; teamIndex < match.teams.length; teamIndex += 1) {
        const team = match.teams[teamIndex];

        await tx.insert(statsTeams).values({
          matchId: match.id,
          teamIndex,
          name: team.name || "",
          score: team.score,
        });

        for (let playerIndex = 0; playerIndex < team.players.length; playerIndex += 1) {
          const player = team.players[playerIndex];
          const [insertedPlayer] = await tx
            .insert(statsPlayers)
            .values({
              matchId: match.id,
              slotKey: `t${teamIndex}-p${playerIndex}`,
              teamIndex,
              playerIndex,
              name: player.name,
              score: player.score,
              kills: player.kills,
              deaths: player.deaths,
              suicides: player.suicides,
              net: player.net,
              damageGiven: player.damageGiven,
              damageTaken: player.damageTaken,
              teamDamage: player.teamDamage ?? 0,
              teamKills: player.teamKills ?? 0,
              healthTotal: player.healthTotal,
              armorTotal: player.armorTotal,
              ctfCaptures: player.ctf?.captures ?? null,
              ctfAssists: player.ctf?.assists ?? null,
              ctfDefense: player.ctf?.defense ?? null,
              ctfReturns: player.ctf?.returns ?? null,
              rawStats: player.rawStats ?? {},
            })
            .returning({ id: statsPlayers.id });

          await insertPlayerChildren(insertedPlayer.id, player);
        }
      }
      return;
    }

    const players = match.players || [];
    for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
      const player = players[playerIndex];
      const [insertedPlayer] = await tx
        .insert(statsPlayers)
        .values({
          matchId: match.id,
          slotKey: `f-p${playerIndex}`,
          teamIndex: null,
          playerIndex,
          name: player.name,
          score: player.score,
          kills: player.kills,
          deaths: player.deaths,
          suicides: player.suicides,
          net: player.net,
          damageGiven: player.damageGiven,
          damageTaken: player.damageTaken,
          teamDamage: player.teamDamage ?? 0,
          teamKills: player.teamKills ?? 0,
          healthTotal: player.healthTotal,
          armorTotal: player.armorTotal,
          ctfCaptures: player.ctf?.captures ?? null,
          ctfAssists: player.ctf?.assists ?? null,
          ctfDefense: player.ctf?.defense ?? null,
          ctfReturns: player.ctf?.returns ?? null,
          rawStats: player.rawStats ?? {},
        })
        .returning({ id: statsPlayers.id });

      await insertPlayerChildren(insertedPlayer.id, player);
    }
  });
}

export async function syncMatchesToStatsDb(matches: MatchStats[]): Promise<{ imported: number }> {
  for (const match of matches) {
    await upsertMatchToStatsDb(match);
  }

  return { imported: matches.length };
}

export async function autoSyncStatsFromXmlToDb(
  minIntervalMs: number = DEFAULT_AUTO_SYNC_INTERVAL_MS,
): Promise<{ imported: number; skipped: boolean }> {
  const now = Date.now();
  if (now - lastAutoSyncAt < minIntervalMs) {
    return { imported: 0, skipped: true };
  }

  if (autoSyncInFlight) {
    return autoSyncInFlight;
  }

  autoSyncInFlight = (async () => {
    const parsedMatches = await getAllMatches();
    if (parsedMatches.length === 0) {
      lastAutoSyncAt = Date.now();
      return { imported: 0, skipped: false };
    }

    const summary = await syncMatchesToStatsDb(parsedMatches);
    lastAutoSyncAt = Date.now();
    return { imported: summary.imported, skipped: false };
  })();

  try {
    return await autoSyncInFlight;
  } finally {
    autoSyncInFlight = null;
  }
}

interface MatchQueryFilters {
  startDate?: Date;
  endDate?: Date;
  map?: string;
  gameType?: string;
}

async function getMatchesCore(filters: MatchQueryFilters = {}): Promise<MatchStats[]> {
  const whereClauses = [];

  if (filters.startDate) {
    whereClauses.push(gte(statsMatches.playedAt, filters.startDate));
  }

  if (filters.endDate) {
    whereClauses.push(lte(statsMatches.playedAt, filters.endDate));
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

  const matchRows = await db
    .select()
    .from(statsMatches)
    .where(whereCondition)
    .orderBy(desc(statsMatches.playedAt));

  if (matchRows.length === 0) {
    return [];
  }

  const matchIds = matchRows.map((row) => row.matchId);

  const [teamRows, playerRows] = await Promise.all([
    db
      .select()
      .from(statsTeams)
      .where(inArray(statsTeams.matchId, matchIds))
      .orderBy(asc(statsTeams.matchId), asc(statsTeams.teamIndex)),
    db
      .select()
      .from(statsPlayers)
      .where(inArray(statsPlayers.matchId, matchIds))
      .orderBy(asc(statsPlayers.matchId), asc(statsPlayers.playerIndex)),
  ]);

  const playerIds = playerRows.map((row) => row.id);
  const [weaponRows, itemRows] = playerIds.length
    ? await Promise.all([
        db
          .select()
          .from(statsPlayerWeapons)
          .where(inArray(statsPlayerWeapons.playerId, playerIds))
          .orderBy(asc(statsPlayerWeapons.playerId), asc(statsPlayerWeapons.weaponIndex)),
        db
          .select()
          .from(statsPlayerItems)
          .where(inArray(statsPlayerItems.playerId, playerIds))
          .orderBy(asc(statsPlayerItems.playerId), asc(statsPlayerItems.itemIndex)),
      ])
    : [[], []];

  const weaponsByPlayer = new Map<string, typeof weaponRows>();
  for (const weapon of weaponRows) {
    const list = weaponsByPlayer.get(weapon.playerId) || [];
    list.push(weapon);
    weaponsByPlayer.set(weapon.playerId, list);
  }

  const itemsByPlayer = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByPlayer.get(item.playerId) || [];
    list.push(item);
    itemsByPlayer.set(item.playerId, list);
  }

  const playersByMatch = new Map<string, PlayerStats[]>();
  const playersByMatchAndTeam = new Map<string, Map<number, PlayerStats[]>>();

  for (const player of playerRows) {
    const playerWeapons = (weaponsByPlayer.get(player.id) || []).map((weapon) => ({
      name: weapon.name,
      hits: weapon.hits,
      shots: weapon.shots,
      kills: weapon.kills,
      accuracy: weapon.accuracy ?? undefined,
    }));

    const playerItems = itemsByPlayer.get(player.id) || [];
    const mappedItems = playerItems
      .filter((item) => item.category === "item")
      .map((item) => ({
        name: item.name,
        pickups: item.pickups,
        time: item.time ?? undefined,
      }));

    const mappedPowerups = playerItems
      .filter((item) => item.category === "powerup")
      .map((item) => ({
        name: item.name,
        pickups: item.pickups,
        time: item.time ?? undefined,
      }));

    const mappedPlayer: PlayerStats = {
      name: player.name,
      score: player.score,
      kills: player.kills,
      deaths: player.deaths,
      suicides: player.suicides,
      net: player.net,
      damageGiven: player.damageGiven,
      damageTaken: player.damageTaken,
      teamDamage: player.teamDamage,
      teamKills: player.teamKills,
      healthTotal: player.healthTotal,
      armorTotal: player.armorTotal,
      rawStats: player.rawStats,
      weapons: playerWeapons,
      items: mappedItems,
      powerups: mappedPowerups,
      ctf:
        player.ctfCaptures === null &&
        player.ctfAssists === null &&
        player.ctfDefense === null &&
        player.ctfReturns === null
          ? undefined
          : {
              captures: player.ctfCaptures ?? 0,
              assists: player.ctfAssists ?? 0,
              defense: player.ctfDefense ?? 0,
              returns: player.ctfReturns ?? 0,
            },
    };

    if (player.teamIndex === null) {
      const list = playersByMatch.get(player.matchId) || [];
      list.push(mappedPlayer);
      playersByMatch.set(player.matchId, list);
      continue;
    }

    const teamsMap = playersByMatchAndTeam.get(player.matchId) || new Map<number, PlayerStats[]>();
    const teamPlayers = teamsMap.get(player.teamIndex) || [];
    teamPlayers.push(mappedPlayer);
    teamsMap.set(player.teamIndex, teamPlayers);
    playersByMatchAndTeam.set(player.matchId, teamsMap);
  }

  const teamsByMatch = new Map<string, TeamStats[]>();
  for (const team of teamRows) {
    const teamsMap = playersByMatchAndTeam.get(team.matchId);
    const players = teamsMap?.get(team.teamIndex) || [];

    const list = teamsByMatch.get(team.matchId) || [];
    list.push({
      name: team.name,
      score: team.score,
      players,
    });
    teamsByMatch.set(team.matchId, list);
  }

  return matchRows.map((match) => ({
    id: match.matchId,
    datetime: match.datetime,
    map: match.map,
    type: match.type,
    isTeamGame: match.isTeamGame,
    duration: match.duration,
    teams: match.isTeamGame ? teamsByMatch.get(match.matchId) || [] : undefined,
    players: !match.isTeamGame ? playersByMatch.get(match.matchId) || [] : undefined,
  }));
}

export async function getMatchesFromStatsDb(filters: MatchQueryFilters = {}): Promise<MatchStats[]> {
  return getMatchesCore(filters);
}

export async function getMatchesByDateFromStatsDb(year: string, month: string, day: string): Promise<MatchStats[]> {
  const start = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0);
  const end = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  return getMatchesCore({ startDate: start, endDate: end });
}

export async function getStatsMatchesCount(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(statsMatches);

  return row?.total ?? 0;
}
