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
import { getServerStatus, refreshServerStatus } from "./q3a-status";
import { RankingFiltersSchema } from "../shared/stats-schema";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { type, map, datetime } = req.query;
      
      if (!type || !map || !datetime) {
        return res.status(400).json({ 
          error: "Missing required parameters: type, map, datetime" 
        });
      }
      
      const screenshots = await getScreenshotsByMatch(
        type as string,
        map as string,
        datetime as string
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
