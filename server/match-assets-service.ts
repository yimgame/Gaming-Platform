import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { matchAssets, type MatchAsset } from "../shared/schema";

export interface MatchAssetInput {
  matchId: string;
  kind: "screenshot" | "demo";
  filename: string;
  sourcePath?: string;
}

export async function getManualMatchAssets(matchId: string, kind?: "screenshot" | "demo"): Promise<MatchAsset[]> {
  if (kind) {
    return db
      .select()
      .from(matchAssets)
      .where(and(eq(matchAssets.matchId, matchId), eq(matchAssets.kind, kind)));
  }

  return db.select().from(matchAssets).where(eq(matchAssets.matchId, matchId));
}

export async function createManualMatchAsset(input: MatchAssetInput): Promise<MatchAsset> {
  const [asset] = await db.insert(matchAssets).values({
    matchId: input.matchId,
    kind: input.kind,
    filename: input.filename,
    sourcePath: input.sourcePath ?? null,
  }).returning();

  return asset;
}
