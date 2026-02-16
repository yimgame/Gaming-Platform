import fs from "node:fs";
import path from "node:path";

export type LevelshotOverride = {
  mapName: string;
  imageUrl: string;
  updatedAt: string;
};

const dataDir = path.resolve(process.cwd(), "data");
const overridesFilePath = path.join(dataDir, "levelshots-overrides.json");

const ensureFile = async () => {
  if (!fs.existsSync(dataDir)) {
    await fs.promises.mkdir(dataDir, { recursive: true });
  }

  if (!fs.existsSync(overridesFilePath)) {
    await fs.promises.writeFile(overridesFilePath, "[]\n", "utf-8");
  }
};

const normalizeMapName = (mapName: string) => mapName.trim().toLowerCase();

const readOverrides = async (): Promise<LevelshotOverride[]> => {
  await ensureFile();

  try {
    const raw = await fs.promises.readFile(overridesFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.mapName === "string" && typeof item.imageUrl === "string")
      .map((item) => ({
        mapName: normalizeMapName(item.mapName),
        imageUrl: String(item.imageUrl).trim(),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
};

const writeOverrides = async (items: LevelshotOverride[]) => {
  await ensureFile();
  const sorted = [...items].sort((a, b) => a.mapName.localeCompare(b.mapName));
  await fs.promises.writeFile(overridesFilePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");
};

export async function listLevelshotOverrides(): Promise<LevelshotOverride[]> {
  return readOverrides();
}

export async function getLevelshotOverride(mapName: string): Promise<LevelshotOverride | null> {
  const normalizedMap = normalizeMapName(mapName);
  if (!normalizedMap) return null;

  const items = await readOverrides();
  const found = items.find((item) => item.mapName === normalizedMap);
  return found || null;
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

  const items = await readOverrides();
  const next: LevelshotOverride = {
    mapName: normalizedMap,
    imageUrl: normalizedUrl,
    updatedAt: new Date().toISOString(),
  };

  const index = items.findIndex((item) => item.mapName === normalizedMap);
  if (index >= 0) {
    items[index] = next;
  } else {
    items.push(next);
  }

  await writeOverrides(items);
  return next;
}

export async function deleteLevelshotOverride(mapName: string): Promise<boolean> {
  const normalizedMap = normalizeMapName(mapName);
  if (!normalizedMap) return false;

  const items = await readOverrides();
  const nextItems = items.filter((item) => item.mapName !== normalizedMap);

  if (nextItems.length === items.length) {
    return false;
  }

  await writeOverrides(nextItems);
  return true;
}
