import fs from "node:fs";
import path from "node:path";
import yauzl from "yauzl";
import { QUAKE3_BASE_PATH, QUAKE_BASE_PATH } from "./config";

const LEVELSHOT_EXTENSIONS = ["jpg", "jpeg", "png", "tga"] as const;

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tga: "image/tga",
};

const isSafeMapName = (mapName: string) => /^[a-zA-Z0-9_-]+$/.test(mapName);

const LEVELSHOTS_PK3_CACHE_MS = 5 * 60 * 1000;
let levelshotsPk3Cache: { expiresAt: number; paths: string[] } | null = null;

const getMapNamedPk3Candidates = (mapName: string): string[] => {
  const names = Array.from(new Set([mapName, mapName.toLowerCase()]));
  const bases = Array.from(new Set([QUAKE3_BASE_PATH, QUAKE_BASE_PATH]));
  const candidates: string[] = [];

  for (const basePath of bases) {
    for (const name of names) {
      candidates.push(path.join(basePath, `${name}.pk3`));
    }
  }

  return candidates;
};

const listPk3Files = async (basePath: string): Promise<string[]> => {
  try {
    const entries = await fs.promises.readdir(basePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pk3"))
      .map((entry) => path.join(basePath, entry.name));
  } catch {
    return [];
  }
};

const pk3ContainsLevelshotsFolder = async (pk3Path: string): Promise<boolean> => {
  return new Promise((resolve) => {
    yauzl.open(pk3Path, { lazyEntries: true, autoClose: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        resolve(false);
        return;
      }

      let resolved = false;

      const finish = (value: boolean) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      zipFile.on("error", () => finish(false));

      zipFile.on("entry", (entry) => {
        const normalizedName = entry.fileName.replace(/\\/g, "/").toLowerCase();
        if (normalizedName.startsWith("levelshots/")) {
          finish(true);
          return;
        }
        zipFile.readEntry();
      });

      zipFile.on("end", () => finish(false));
      zipFile.readEntry();
    });
  });
};

const getPk3WithLevelshots = async (): Promise<string[]> => {
  const now = Date.now();
  if (levelshotsPk3Cache && now < levelshotsPk3Cache.expiresAt) {
    return levelshotsPk3Cache.paths;
  }

  const bases = Array.from(new Set([QUAKE3_BASE_PATH, QUAKE_BASE_PATH]));
  const allPk3Paths = (await Promise.all(bases.map((basePath) => listPk3Files(basePath)))).flat();

  const matches: string[] = [];
  for (const pk3Path of allPk3Paths) {
    if (await pk3ContainsLevelshotsFolder(pk3Path)) {
      matches.push(pk3Path);
    }
  }

  levelshotsPk3Cache = {
    expiresAt: now + LEVELSHOTS_PK3_CACHE_MS,
    paths: matches,
  };

  return matches;
};

const collectStreamBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
};

const extractLevelshotFromPk3 = async (
  pk3Path: string,
  mapName: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> => {
  if (!fs.existsSync(pk3Path)) {
    return null;
  }

  const normalizedTargets = new Set(
    LEVELSHOT_EXTENSIONS.flatMap((ext) => [
      `levelshots/${mapName}.${ext}`.toLowerCase(),
      `levelshots/${mapName.toLowerCase()}.${ext}`.toLowerCase(),
    ]),
  );

  return new Promise((resolve, reject) => {
    yauzl.open(pk3Path, { lazyEntries: true, autoClose: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        resolve(null);
        return;
      }

      let finished = false;

      const finish = (value: { buffer: Buffer; mimeType: string } | null) => {
        if (finished) return;
        finished = true;
        resolve(value);
      };

      zipFile.on("error", (zipError) => {
        if (!finished) reject(zipError);
      });

      zipFile.on("entry", (entry) => {
        const normalizedName = entry.fileName.replace(/\\/g, "/").toLowerCase();
        if (!normalizedTargets.has(normalizedName)) {
          zipFile.readEntry();
          return;
        }

        const extension = normalizedName.split(".").pop() || "jpg";
        const mimeType = mimeByExtension[extension] || "application/octet-stream";

        zipFile.openReadStream(entry, async (streamError, readStream) => {
          if (streamError || !readStream) {
            if (!finished) reject(streamError || new Error("No se pudo abrir el levelshot"));
            return;
          }

          try {
            const buffer = await collectStreamBuffer(readStream);
            finish({ buffer, mimeType });
          } catch (error) {
            if (!finished) reject(error);
          }
        });
      });

      zipFile.on("end", () => {
        finish(null);
      });

      zipFile.readEntry();
    });
  });
};

export async function getMapLevelshot(mapName: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!mapName || !isSafeMapName(mapName)) {
    return null;
  }

  const mapNamedPk3 = getMapNamedPk3Candidates(mapName);
  const pk3WithLevelshots = await getPk3WithLevelshots();
  const pk3Candidates = Array.from(new Set([...mapNamedPk3, ...pk3WithLevelshots]));

  for (const pk3Path of pk3Candidates) {
    const levelshot = await extractLevelshotFromPk3(pk3Path, mapName);
    if (levelshot) {
      return levelshot;
    }
  }

  return null;
}
