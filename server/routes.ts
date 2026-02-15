import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  calculateGlobalRanking, 
  getMatchRanking, 
  getServerStats,
  getTopPlayers 
} from "./stats-service";
import { 
  getAllMatches, 
  getMatchesByDate, 
  parseMatchXML 
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
  createManualMatchAssetIfMissing,
  getManualMatchAssets
} from "./match-assets-service";
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
import { RankingFiltersSchema } from "../shared/stats-schema";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
  const isAdminRequest = (token: string | undefined) => {
    if (!ADMIN_TOKEN) return false;
    return token === ADMIN_TOKEN;
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
      const matches = await getAllMatches();
      res.json({ matches });
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });
  
  // Obtener partidas de un día específico
  app.get("/api/stats/matches/:year/:month/:day", async (req, res) => {
    try {
      const { year, month, day } = req.params;
      const matches = await getMatchesByDate(year, month, day);
      res.json({ matches });
    } catch (error) {
      console.error("Error fetching matches by date:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
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
      const manualFilenames = manualAssets.map(asset => asset.filename);
      
      const screenshots = await getScreenshotsByMatch(
        type as string,
        map as string,
        datetime as string,
        4,
        manualFilenames
      );
      
      res.json({ screenshots });
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
      const manualFilenames = manualAssets.map(asset => asset.filename);

      const demos = await getDemosByMatch(
        type as string,
        map as string,
        datetime as string,
        4,
        manualFilenames
      );

      res.json({ demos });
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

  // SSL es manejado por Nginx (en Docker) o por Let's Encrypt
  const httpServer = createServer(app);

  return httpServer;
}
