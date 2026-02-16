import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "node:path";
import { storage } from "./storage";
import { 
  calculateGlobalRanking, 
  getMatchRanking, 
  getServerStats,
  getTopPlayers 
} from "./stats-service";
import { 
  getAllMatches, 
  getMatchesByDate 
} from "./stats-parser";
import { 
  getAllScreenshots, 
  getScreenshotsPaginated, 
  getLatestScreenshots,
  getScreenshotPath,
  getScreenshotsByMatch,
  getScreenshotsByMapName
} from "./screenshots-service";
import {
  getAllDemos,
  getDemoPath,
  getDemosByMatch
} from "./demos-service";
import {
  createManualMatchAsset,
  createManualMatchAssetIfMissing,
  getManualMatchAssetById,
  getManualMatchAssets
} from "./match-assets-service";
import {
  autoSyncStatsFromXmlToDb,
  getMatchesByDateFromStatsDb,
  getMatchesFromStatsDb,
  isMissingStatsTablesError,
  syncMatchesToStatsDb,
} from "./match-stats-db-service";
import {
  createContactMessage,
  getContactMessages,
  getSiteSettingsData,
  updateSiteSettingsData,
} from "./site-settings-service";
import {
  createGameConfig,
  deleteGameConfig,
  getGamesConfig,
  updateGameConfig,
} from "./games-config-service";
import {
  ADMIN_TOKEN,
  COUNTER16_BASE_PATH,
  CS2_BASE_PATH,
  DEMOS_BASE_PATH,
  MINECRAFT_BASE_PATH,
  QUAKE2_BASE_PATH,
  QUAKE3_BASE_PATH,
  QUAKE_BASE_PATH,
  SCREENSHOTS_BASE_PATH,
  STATS_BASE_PATH,
} from "./config";
import { getServerStatus, refreshServerStatus } from "./q3a-status";
import { getMapLevelshot } from "./levelshots-service";
import {
  deleteLevelshotOverride,
  getLevelshotOverride,
  listLevelshotOverrides,
  upsertLevelshotOverride,
} from "./levelshots-overrides-service";
import {
  createBackupNow,
  getBackupStatus,
  getBackupZipForDownload,
  listBackups,
  registerUploadedManualBackup,
  restoreBackupFromScope,
  setBackupsEnabled,
  startBackupsScheduler,
  updateBackupSettings,
} from "./backups-service";
import { RankingFiltersSchema } from "../shared/stats-schema";
import fs from "fs";
import multer from "multer";

const LEVELSHOTS_UPLOAD_DIR = path.resolve(process.cwd(), "data", "levelshots-images");
const MATCH_ASSETS_UPLOAD_DIR = path.resolve(process.cwd(), "data", "match-assets");
const MATCH_DEMOS_UPLOAD_DIR = path.join(MATCH_ASSETS_UPLOAD_DIR, "demos");
const MATCH_SCREENSHOTS_UPLOAD_DIR = path.join(MATCH_ASSETS_UPLOAD_DIR, "screenshots");
const BACKUPS_UPLOAD_TEMP_DIR = path.resolve(process.cwd(), "data", "backups-upload-temp");

const ensureLevelshotsUploadDir = async () => {
  await fs.promises.mkdir(LEVELSHOTS_UPLOAD_DIR, { recursive: true });
};

const ensureMatchAssetsUploadDirs = async () => {
  await fs.promises.mkdir(MATCH_DEMOS_UPLOAD_DIR, { recursive: true });
  await fs.promises.mkdir(MATCH_SCREENSHOTS_UPLOAD_DIR, { recursive: true });
};

const ensureBackupsUploadTempDir = async () => {
  await fs.promises.mkdir(BACKUPS_UPLOAD_TEMP_DIR, { recursive: true });
};

const sanitizeMapName = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
const sanitizeFileNamePart = (value: string) => value.replace(/[^a-zA-Z0-9_.-]/g, "_");

const levelshotsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, LEVELSHOTS_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const requestedMap = String(req.body?.mapName || "").trim();
      const safeMap = sanitizeMapName(requestedMap) || "map";
      const extensionFromName = path.extname(file.originalname || "").toLowerCase();
      const extension = [".jpg", ".jpeg", ".png", ".tga"].includes(extensionFromName)
        ? extensionFromName
        : ".jpg";

      cb(null, `${safeMap}-${Date.now()}${extension}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || "").startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Solo se permiten archivos de imagen"));
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const matchAssetsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const kind = String(req.body?.kind || "").toLowerCase();
      if (kind === "demo") {
        cb(null, MATCH_DEMOS_UPLOAD_DIR);
        return;
      }
      if (kind === "screenshot") {
        cb(null, MATCH_SCREENSHOTS_UPLOAD_DIR);
        return;
      }
      cb(new Error("kind must be demo or screenshot"), MATCH_ASSETS_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const kind = String(req.body?.kind || "").toLowerCase();
      const extensionFromName = path.extname(file.originalname || "").toLowerCase();
      const extension = extensionFromName || (kind === "demo" ? ".dm_68" : ".jpg");
      const baseName = sanitizeFileNamePart(path.basename(file.originalname || "asset", extension));
      cb(null, `${Date.now()}-${baseName}${extension}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const kind = String(req.body?.kind || "").toLowerCase();
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (kind === "demo") {
      if (/^\.dm_\d+$/i.test(extension)) {
        cb(null, true);
        return;
      }
      cb(new Error("Demo invalida. Debe ser .dm_XX"));
      return;
    }

    if (kind === "screenshot") {
      if ((file.mimetype || "").startsWith("image/") || [".tga", ".bmp"].includes(extension)) {
        cb(null, true);
        return;
      }
      cb(new Error("Captura invalida. Debe ser imagen"));
      return;
    }

    cb(new Error("kind must be demo or screenshot"));
  },
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, BACKUPS_UPLOAD_TEMP_DIR);
    },
    filename: (_req, file, cb) => {
      const safeBase = sanitizeFileNamePart(path.basename(file.originalname || "backup", path.extname(file.originalname || "")));
      cb(null, `${Date.now()}-${safeBase}.zip`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (extension === ".zip") {
      cb(null, true);
      return;
    }
    cb(new Error("Solo se permite archivo .zip"));
  },
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureLevelshotsUploadDir();
  await ensureMatchAssetsUploadDirs();
  await ensureBackupsUploadTempDir();
  await startBackupsScheduler();

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    try {
      return String(error);
    } catch {
      return "Unknown error";
    }
  };

  const logRouteError = (context: string, error: unknown) => {
    console.error(`${context}: ${getErrorMessage(error)}`);
  };

  const isAdminRequest = (token: string | undefined) => {
    if (!ADMIN_TOKEN) return false;
    return token === ADMIN_TOKEN;
  };

  const toUploadedMediaEntry = (asset: { id: string; filename: string; sourcePath: string | null }) => {
    const extension = path.extname(asset.filename || "").toLowerCase();
    const mimeType =
      extension === ".png"
        ? "image/png"
        : extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".tga"
            ? "image/tga"
            : extension === ".bmp"
              ? "image/bmp"
              : "application/octet-stream";

    return {
      filename: asset.filename,
      path: asset.sourcePath || "",
      url: `/api/match-assets/files/${encodeURIComponent(asset.id)}`,
      mimeType,
    };
  };

  app.get("/api/admin/status", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    const enabled = isAdminRequest(token);
    res.json({ enabled });
  });

  app.get("/api/admin/config", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    res.json({
      quakeBasePath: QUAKE_BASE_PATH,
      quake2BasePath: QUAKE2_BASE_PATH,
      quake3BasePath: QUAKE3_BASE_PATH,
      counter16BasePath: COUNTER16_BASE_PATH,
      cs2BasePath: CS2_BASE_PATH,
      minecraftBasePath: MINECRAFT_BASE_PATH,
      statsPath: STATS_BASE_PATH,
      screenshotsPath: SCREENSHOTS_BASE_PATH,
      demosPath: DEMOS_BASE_PATH,
    });
  });

  app.get("/api/admin/backups/status", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const status = await getBackupStatus();
      res.json({ status });
    } catch (error) {
      logRouteError("Error fetching backups status", error);
      res.status(500).json({ error: "Failed to fetch backups status" });
    }
  });

  app.get("/api/admin/backups", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const backups = await listBackups();
      res.json({ backups });
    } catch (error) {
      logRouteError("Error listing backups", error);
      res.status(500).json({ error: "Failed to list backups" });
    }
  });

  app.put("/api/admin/backups/settings", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const status = await updateBackupSettings(req.body || {});
      res.json({ status });
    } catch (error) {
      logRouteError("Error updating backup settings", error);
      res.status(400).json({ error: "Failed to update backup settings" });
    }
  });

  app.post("/api/admin/backups/start", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const status = await setBackupsEnabled(true);
      res.json({ status });
    } catch (error) {
      logRouteError("Error starting backups", error);
      res.status(500).json({ error: "Failed to start backups" });
    }
  });

  app.post("/api/admin/backups/stop", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const status = await setBackupsEnabled(false);
      res.json({ status });
    } catch (error) {
      logRouteError("Error stopping backups", error);
      res.status(500).json({ error: "Failed to stop backups" });
    }
  });

  app.post("/api/admin/backups/run", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const result = await createBackupNow();
      if (!result.ok) {
        return res.status(400).json(result);
      }

      const status = await getBackupStatus();
      res.json({ ...result, status });
    } catch (error) {
      logRouteError("Error creating backup", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.post("/api/admin/backups/restore", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const filename = String(req.body?.filename || "").trim();
      const scope = req.body?.scope === "manual" ? "manual" : "default";
      const confirmRestore = Boolean(req.body?.confirmRestore);
      const result = await restoreBackupFromScope(scope, filename, confirmRestore);

      if (!result.ok) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      logRouteError("Error restoring backup", error);
      res.status(500).json({ error: "Failed to restore backup" });
    }
  });

  app.get("/api/admin/backups/download/:scope/:filename", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const scope = req.params.scope === "manual" ? "manual" : "default";
      const filename = String(req.params.filename || "").trim();
      const fullPath = await getBackupZipForDownload(scope, filename);

      if (!fullPath) {
        return res.status(404).json({ error: "Backup not found" });
      }

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    } catch (error) {
      logRouteError("Error downloading backup", error);
      res.status(500).json({ error: "Failed to download backup" });
    }
  });

  app.post("/api/admin/backups/upload", (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    backupUpload.single("file")(req, res, async (uploadError) => {
      if (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload error";
        return res.status(400).json({ error: message });
      }

      const file = (req as unknown as { file?: { path: string; originalname: string } }).file;
      if (!file) {
        return res.status(400).json({ error: "No backup file provided" });
      }

      try {
        const result = await registerUploadedManualBackup(file.path, file.originalname);
        if (!result.ok) {
          return res.status(400).json(result);
        }

        const backups = await listBackups();
        return res.status(201).json({ result, backups });
      } catch (error) {
        logRouteError("Error uploading manual backup", error);
        return res.status(500).json({ error: "Failed to upload backup" });
      }
    });
  });

  app.get("/api/site-settings", async (_req, res) => {
    try {
      const settings = await getSiteSettingsData();
      res.json({ settings });
    } catch (error) {
      logRouteError("Error fetching site settings", error);
      res.status(500).json({ error: "Failed to fetch site settings" });
    }
  });

  app.post("/api/contact-messages", async (req, res) => {
    try {
      const message = await createContactMessage(req.body || {});
      res.status(201).json({ message });
    } catch (error) {
      logRouteError("Error creating contact message", error);
      if (error instanceof Error && error.message === "DB_MISSING_CONTACT_TABLE") {
        return res.status(503).json({
          error: "Contact messages storage not initialized. Run: npm run db:push",
        });
      }
      res.status(400).json({ error: "Failed to send contact message" });
    }
  });

  app.get("/api/admin/site-settings", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const settings = await getSiteSettingsData();
      res.json({ settings });
    } catch (error) {
      logRouteError("Error fetching admin site settings", error);
      res.status(500).json({ error: "Failed to fetch admin site settings" });
    }
  });

  app.put("/api/admin/site-settings", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const settings = await updateSiteSettingsData(req.body || {});
      res.json({ settings });
    } catch (error) {
      logRouteError("Error updating admin site settings", error);
      if (error instanceof Error && error.message === "DB_MISSING_SITE_TABLE") {
        return res.status(503).json({
          error: "Site settings storage not initialized. Run: npm run db:push",
        });
      }
      res.status(400).json({ error: "Failed to update admin site settings" });
    }
  });

  app.get("/api/admin/contact-messages", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
      const messages = await getContactMessages(rawLimit);
      res.json({ messages });
    } catch (error) {
      logRouteError("Error fetching admin contact messages", error);
      res.status(500).json({ error: "Failed to fetch contact messages" });
    }
  });

  app.get("/api/admin/levelshots", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const levelshots = await listLevelshotOverrides();
      res.json({ levelshots });
    } catch (error) {
      logRouteError("Error fetching levelshot overrides", error);
      res.status(500).json({ error: "Failed to fetch levelshot overrides" });
    }
  });

  app.post("/api/admin/levelshots", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const mapName = String(req.body?.mapName || "").trim();
      const imageUrl = String(req.body?.imageUrl || "").trim();
      const isValidUrl = /^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("/");

      if (!mapName) {
        return res.status(400).json({ error: "Map name is required" });
      }

      if (!isValidUrl) {
        return res.status(400).json({ error: "Image URL must start with /, http:// or https://" });
      }

      const levelshot = await upsertLevelshotOverride(mapName, imageUrl);
      res.json({ levelshot });
    } catch (error) {
      logRouteError("Error upserting levelshot override", error);
      if (error instanceof Error && error.message === "DB_MISSING_LEVELSHOT_TABLE") {
        return res.status(503).json({
          error: "Levelshot overrides storage not initialized. Run: npm run db:push",
        });
      }
      res.status(400).json({ error: "Failed to save levelshot override" });
    }
  });

  app.post("/api/admin/levelshots/upload", (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    levelshotsUpload.single("image")(req, res, (uploadError) => {
      if (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload error";
        return res.status(400).json({ error: message });
      }

      const file = (req as unknown as { file?: { filename: string } }).file;
      if (!file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      return res.json({
        imageUrl: `/api/levelshots-files/${encodeURIComponent(file.filename)}`,
      });
    });
  });

  app.delete("/api/admin/levelshots/:mapName", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const deleted = await deleteLevelshotOverride(req.params.mapName || "");
      if (!deleted) {
        return res.status(404).json({ error: "Levelshot override not found" });
      }

      res.status(204).send();
    } catch (error) {
      logRouteError("Error deleting levelshot override", error);
      res.status(500).json({ error: "Failed to delete levelshot override" });
    }
  });

  app.get("/api/games", async (_req, res) => {
    try {
      const games = await getGamesConfig();
      res.json({ games });
    } catch (error) {
      console.error("Error fetching games config:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.get("/api/admin/games", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const games = await getGamesConfig();
      res.json({ games });
    } catch (error) {
      console.error("Error fetching admin games config:", error);
      res.status(500).json({ error: "Failed to fetch admin games" });
    }
  });

  app.post("/api/admin/games", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const game = await createGameConfig(req.body);
      res.status(201).json({ game });
    } catch (error) {
      console.error("Error creating game config:", error);
      res.status(400).json({ error: "Failed to create game config" });
    }
  });

  app.put("/api/admin/games/:id", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const game = await updateGameConfig(req.params.id, req.body);
      res.json({ game });
    } catch (error) {
      console.error("Error updating game config:", error);
      res.status(400).json({ error: "Failed to update game config" });
    }
  });

  app.delete("/api/admin/games/:id", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      await deleteGameConfig(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting game config:", error);
      res.status(400).json({ error: "Failed to delete game config" });
    }
  });

  // Estadísticas de CPMA
  
  // Obtener todas las partidas
  app.get("/api/stats/matches", async (req, res) => {
    try {
      await autoSyncStatsFromXmlToDb();
      let matches = await getMatchesFromStatsDb();
      if (matches.length === 0) {
        const parsedMatches = await getAllMatches();
        if (parsedMatches.length > 0) {
          await syncMatchesToStatsDb(parsedMatches);
          matches = await getMatchesFromStatsDb();
        }
      }

      res.json({ matches });
    } catch (error) {
      if (isMissingStatsTablesError(error)) {
        try {
          const matches = await getAllMatches();
          return res.json({ matches });
        } catch (fallbackError) {
          console.error("Error fetching matches from XML fallback:", fallbackError);
        }
      }
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });
  
  // Obtener partidas de un día específico
  app.get("/api/stats/matches/:year/:month/:day", async (req, res) => {
    try {
      await autoSyncStatsFromXmlToDb();
      const { year, month, day } = req.params;
      let matches = await getMatchesByDateFromStatsDb(year, month, day);
      if (matches.length === 0) {
        const parsedMatches = await getMatchesByDate(year, month, day);
        if (parsedMatches.length > 0) {
          await syncMatchesToStatsDb(parsedMatches);
          matches = await getMatchesByDateFromStatsDb(year, month, day);
        }
      }

      res.json({ matches });
    } catch (error) {
      if (isMissingStatsTablesError(error)) {
        try {
          const { year, month, day } = req.params;
          const matches = await getMatchesByDate(year, month, day);
          return res.json({ matches });
        } catch (fallbackError) {
          console.error("Error fetching matches by date from XML fallback:", fallbackError);
        }
      }
      console.error("Error fetching matches by date:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.post("/api/admin/stats/sync", async (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    try {
      const summary = await autoSyncStatsFromXmlToDb(0);
      res.json({
        ok: true,
        imported: summary.imported,
      });
    } catch (error) {
      console.error("Error syncing match stats to DB:", error);
      res.status(500).json({ error: "Failed to sync stats" });
    }
  });
  
  // Obtener ranking global con filtros
  app.post("/api/stats/ranking/global", async (req, res) => {
    try {
      const filters = RankingFiltersSchema.parse(req.body);
      const ranking = await calculateGlobalRanking(filters);
      res.json({ ranking });
    } catch (error) {
      console.error("Error calculating global ranking:", error);
      res.status(500).json({ error: "Failed to calculate ranking" });
    }
  });
  
  // Obtener estadísticas del servidor
  app.get("/api/stats/server", async (req, res) => {
    try {
      const stats = await getServerStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching server stats:", error);
      res.status(500).json({ error: "Failed to fetch server stats" });
    }
  });
  
  // Obtener top jugadores
  app.get("/api/stats/top-players", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const topPlayers = await getTopPlayers(limit);
      res.json(topPlayers);
    } catch (error) {
      console.error("Error fetching top players:", error);
      res.status(500).json({ error: "Failed to fetch top players" });
    }
  });

  // Estado del servidor Quake 3
  
  // Obtener estado actual del servidor (con cache de 30s)
  app.get("/api/server/status", async (req, res) => {
    try {
      const status = await getServerStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching server status:", error);
      res.status(500).json({ 
        online: false, 
        error: "Failed to fetch server status" 
      });
    }
  });

  // Forzar actualización del estado del servidor
  app.post("/api/server/refresh", async (req, res) => {
    try {
      const status = await refreshServerStatus();
      res.json(status);
    } catch (error) {
      console.error("Error refreshing server status:", error);
      res.status(500).json({ 
        online: false, 
        error: "Failed to refresh server status" 
      });
    }
  });

  // Screenshots de CPMA
  
  // Obtener todas las screenshots
  app.get("/api/screenshots", async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const result = await getScreenshotsPaginated(page, limit);
      res.json(result);
    } catch (error) {
      console.error("Error fetching screenshots:", error);
      res.status(500).json({ error: "Failed to fetch screenshots" });
    }
  });
  
  // Obtener últimas screenshots
  app.get("/api/screenshots/latest", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
      const screenshots = await getLatestScreenshots(limit);
      res.json({ screenshots });
    } catch (error) {
      console.error("Error fetching latest screenshots:", error);
      res.status(500).json({ error: "Failed to fetch screenshots" });
    }
  });

  // Obtener screenshots correlacionadas con una partida
  app.get("/api/screenshots/match", async (req, res) => {
    try {
      const { type, map, datetime, matchId } = req.query;
      
      if (!type || !map || !datetime) {
        return res.status(400).json({ 
          error: "Missing required parameters: type, map, datetime" 
        });
      }

      let manualAssets: Awaited<ReturnType<typeof getManualMatchAssets>> = [];
      if (matchId) {
        try {
          manualAssets = await getManualMatchAssets(matchId as string, "screenshot");
        } catch (error) {
          console.error("Error fetching manual screenshot assets, using auto match only:", error);
        }
      }
      const uploadedAssets = manualAssets.filter((asset) => Boolean(asset.sourcePath));
      const uploadedScreenshots = uploadedAssets.map(toUploadedMediaEntry);
      const manualFilenames = manualAssets
        .filter((asset) => !asset.sourcePath)
        .map(asset => asset.filename);
      
      const screenshots = await getScreenshotsByMatch(
        type as string,
        map as string,
        datetime as string,
        4,
        manualFilenames
      );

      const mergedScreenshots = [...uploadedScreenshots, ...screenshots];
      const seenScreenshots = new Set<string>();
      const uniqueScreenshots = mergedScreenshots.filter((item) => {
        const key = item.url;
        if (seenScreenshots.has(key)) return false;
        seenScreenshots.add(key);
        return true;
      });
      
      res.json({ screenshots: uniqueScreenshots });
    } catch (error) {
      console.error("Error fetching match screenshots:", error);
      res.status(500).json({ error: "Failed to fetch match screenshots" });
    }
  });

  // Obtener screenshots por nombre de mapa (simple, sin timestamp)
  app.get("/api/screenshots/map/:mapName", async (req, res) => {
    try {
      const { mapName } = req.params;
      
      if (!mapName) {
        return res.status(400).json({ 
          error: "Missing map name" 
        });
      }
      
      const screenshots = await getScreenshotsByMapName(mapName);
      
      res.json({ screenshots });
    } catch (error) {
      console.error("Error fetching map screenshots:", error);
      res.status(500).json({ error: "Failed to fetch map screenshots" });
    }
  });

  // Demos de CPMA

  // Obtener todas las demos
  app.get("/api/demos", async (_req, res) => {
    try {
      const demos = await getAllDemos();
      res.json({ demos });
    } catch (error) {
      console.error("Error fetching demos:", error);
      res.status(500).json({ error: "Failed to fetch demos" });
    }
  });

  // Obtener demos correlacionadas con una partida
  app.get("/api/demos/match", async (req, res) => {
    try {
      const { type, map, datetime, matchId } = req.query;

      if (!type || !map || !datetime) {
        return res.status(400).json({
          error: "Missing required parameters: type, map, datetime"
        });
      }

      let manualAssets: Awaited<ReturnType<typeof getManualMatchAssets>> = [];
      if (matchId) {
        try {
          manualAssets = await getManualMatchAssets(matchId as string, "demo");
        } catch (error) {
          console.error("Error fetching manual demo assets, using auto match only:", error);
        }
      }
      const uploadedAssets = manualAssets.filter((asset) => Boolean(asset.sourcePath));
      const uploadedDemos = uploadedAssets.map(toUploadedMediaEntry);
      const manualFilenames = manualAssets
        .filter((asset) => !asset.sourcePath)
        .map(asset => asset.filename);

      const demos = await getDemosByMatch(
        type as string,
        map as string,
        datetime as string,
        4,
        manualFilenames
      );

      const mergedDemos = [...uploadedDemos, ...demos];
      const seenDemos = new Set<string>();
      const uniqueDemos = mergedDemos.filter((item) => {
        const key = item.url;
        if (seenDemos.has(key)) return false;
        seenDemos.add(key);
        return true;
      });

      res.json({ demos: uniqueDemos });
    } catch (error) {
      console.error("Error fetching match demos:", error);
      res.status(500).json({ error: "Failed to fetch match demos" });
    }
  });

  // Servir archivo de demo
  app.get("/api/demos/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = await getDemoPath(filename);

      if (!filePath) {
        return res.status(404).json({ error: "Demo not found" });
      }

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving demo:", error);
      res.status(500).json({ error: "Failed to serve demo" });
    }
  });

  // Match assets manuales (demos/screenshots)
  app.get("/api/match-assets/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      const kind = req.query.kind as "screenshot" | "demo" | undefined;

      if (!matchId) {
        return res.status(400).json({ error: "Missing matchId" });
      }

      const assets = await getManualMatchAssets(matchId, kind);
      res.json({ assets });
    } catch (error) {
      console.error("Error fetching match assets:", error);
      res.status(500).json({ error: "Failed to fetch match assets" });
    }
  });

  app.post("/api/match-assets", async (req, res) => {
    try {
      const token = req.header("x-admin-token") || req.body?.adminToken as string | undefined;
      if (!isAdminRequest(token)) {
        return res.status(403).json({ error: "Admin token required" });
      }

      const { matchId, kind, filename, sourcePath } = req.body || {};

      if (!matchId || !kind || !filename) {
        return res.status(400).json({
          error: "Missing required fields: matchId, kind, filename"
        });
      }

      if (kind !== "screenshot" && kind !== "demo") {
        return res.status(400).json({ error: "Invalid kind" });
      }

      const asset = await createManualMatchAssetIfMissing({
        matchId,
        kind,
        filename,
        sourcePath,
      });

      res.json({
        asset,
        created: Boolean(asset),
      });
    } catch (error) {
      console.error("Error creating match asset:", error);
      res.status(500).json({ error: "Failed to create match asset" });
    }
  });

  app.post("/api/match-assets/upload", (req, res) => {
    const token = req.header("x-admin-token") || req.query.adminToken as string | undefined;
    if (!isAdminRequest(token)) {
      return res.status(403).json({ error: "Admin token required" });
    }

    matchAssetsUpload.single("file")(req, res, async (uploadError) => {
      if (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Upload error";
        return res.status(400).json({ error: message });
      }

      try {
        const file = (req as unknown as { file?: { filename: string; path: string; originalname: string } }).file;
        const matchId = String(req.body?.matchId || "").trim();
        const kind = String(req.body?.kind || "").trim() as "screenshot" | "demo";

        if (!matchId || !kind || (kind !== "screenshot" && kind !== "demo")) {
          return res.status(400).json({ error: "Missing required fields: matchId, kind" });
        }

        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const asset = await createManualMatchAsset({
          matchId,
          kind,
          filename: file.originalname || file.filename,
          sourcePath: file.path,
        });

        return res.status(201).json({
          asset,
          fileUrl: `/api/match-assets/files/${encodeURIComponent(asset.id)}`,
        });
      } catch (error) {
        logRouteError("Error uploading match asset", error);
        return res.status(500).json({ error: "Failed to upload match asset" });
      }
    });
  });

  app.get("/api/match-assets/files/:assetId", async (req, res) => {
    try {
      const assetId = String(req.params.assetId || "").trim();
      if (!assetId) {
        return res.status(400).json({ error: "Missing assetId" });
      }

      const asset = await getManualMatchAssetById(assetId);
      if (!asset || !asset.sourcePath) {
        return res.status(404).json({ error: "Asset not found" });
      }

      if (!fs.existsSync(asset.sourcePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const ext = path.extname(asset.filename || "").toLowerCase();
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".tga"
              ? "image/tga"
              : ext === ".bmp"
                ? "image/bmp"
                : "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");

      if (asset.kind === "demo") {
        res.setHeader("Content-Disposition", `attachment; filename="${asset.filename}"`);
      }

      const fileStream = fs.createReadStream(asset.sourcePath);
      fileStream.pipe(res);
    } catch (error) {
      logRouteError("Error serving uploaded match asset", error);
      res.status(500).json({ error: "Failed to serve uploaded match asset" });
    }
  });
  
  // Servir archivo de screenshot
  app.get("/api/screenshots/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = await getScreenshotPath(filename);
      
      if (!filePath) {
        return res.status(404).json({ error: "Screenshot not found" });
      }
      
      // Detectar tipo MIME
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'tga': 'image/tga',
        'bmp': 'image/bmp',
      };
      
      const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 año
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving screenshot:", error);
      res.status(500).json({ error: "Failed to serve screenshot" });
    }
  });

  // Servir levelshot de mapa desde su pk3
  app.get("/api/levelshots/:mapName", async (req, res) => {
    try {
      const { mapName } = req.params;
      const override = await getLevelshotOverride(mapName);
      if (override) {
        return res.redirect(302, override.imageUrl);
      }

      const levelshot = await getMapLevelshot(mapName);

      if (!levelshot) {
        return res.status(404).json({ error: "Levelshot not found" });
      }

      res.setHeader("Content-Type", levelshot.mimeType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(levelshot.buffer);
    } catch (error) {
      console.error("Error serving levelshot:", error);
      res.status(500).json({ error: "Failed to serve levelshot" });
    }
  });

  app.get("/api/levelshots-files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      if (!filename || filename.includes("/") || filename.includes("\\")) {
        return res.status(400).json({ error: "Invalid filename" });
      }

      const filePath = path.join(LEVELSHOTS_UPLOAD_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const ext = path.extname(filename).toLowerCase();
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".tga"
              ? "image/tga"
              : "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logRouteError("Error serving levelshot file", error);
      res.status(500).json({ error: "Failed to serve levelshot file" });
    }
  });

  // SSL es manejado por Nginx (en Docker) o por Let's Encrypt
  const httpServer = createServer(app);

  return httpServer;
}
