import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { levelshotOverrides } from "../shared/schema";

export type LevelshotOverride = {
  mapName: string;
  imageUrl: string;
  updatedAt: string;
};

const normalizeMapName = (mapName: string) => mapName.trim().toLowerCase();

const getPgErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : undefined;
};

const isMissingRelationError = (error: unknown) => getPgErrorCode(error) === "42P01";

export async function listLevelshotOverrides(): Promise<LevelshotOverride[]> {
  try {
    const rows = await db.select().from(levelshotOverrides);
    return rows
      .map((row) => ({
        mapName: normalizeMapName(row.mapName),
        imageUrl: row.imageUrl,
        updatedAt: row.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.mapName.localeCompare(b.mapName));
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getLevelshotOverride(mapName: string): Promise<LevelshotOverride | null> {
  const normalizedMap = normalizeMapName(mapName);
  if (!normalizedMap) return null;

  try {
    const [row] = await db
      .select()
      .from(levelshotOverrides)
      .where(eq(levelshotOverrides.mapName, normalizedMap))
      .limit(1);

    if (!row) return null;

    return {
      mapName: normalizeMapName(row.mapName),
      imageUrl: row.imageUrl,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw error;
  }
}

export async function upsertLevelshotOverride(mapName: string, imageUrl: string): Promise<LevelshotOverride> {
  const normalizedMap = normalizeMapName(mapName);
  const normalizedUrl = imageUrl.trim();

  if (!normalizedMap) {
    throw new Error("INVALID_MAP_NAME");
  }

  if (!normalizedUrl) {
    throw new Error("INVALID_IMAGE_URL");
  }

  try {
    const [existing] = await db
      .select({ mapName: levelshotOverrides.mapName })
      .from(levelshotOverrides)
      .where(eq(levelshotOverrides.mapName, normalizedMap))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(levelshotOverrides)
        .set({
          imageUrl: normalizedUrl,
          updatedAt: sql`now()`,
        })
        .where(eq(levelshotOverrides.mapName, normalizedMap))
        .returning();

      return {
        mapName: normalizeMapName(updated.mapName),
        imageUrl: updated.imageUrl,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }

    const [created] = await db
      .insert(levelshotOverrides)
      .values({
        mapName: normalizedMap,
        imageUrl: normalizedUrl,
      })
      .returning();

    return {
      mapName: normalizeMapName(created.mapName),
      imageUrl: created.imageUrl,
      updatedAt: created.updatedAt.toISOString(),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new Error("DB_MISSING_LEVELSHOT_TABLE");
    }
    throw error;
  }
}

export async function deleteLevelshotOverride(mapName: string): Promise<boolean> {
  const normalizedMap = normalizeMapName(mapName);
  if (!normalizedMap) return false;

  try {
    const deleted = await db
      .delete(levelshotOverrides)
      .where(eq(levelshotOverrides.mapName, normalizedMap))
      .returning({ mapName: levelshotOverrides.mapName });

    return deleted.length > 0;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }
}
