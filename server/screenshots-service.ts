import { promises as fs } from 'fs';
import * as path from 'path';

// Ruta base para screenshots
const SCREENSHOTS_BASE_PATH = process.env.SCREENSHOTS_PATH || 'G:\\Games\\Quake3\\cpma\\screenshots';

export interface Screenshot {
  filename: string;
  path: string;
  url: string;
  timestamp?: Date;
  size?: number;
}

/**
 * Obtiene todas las screenshots disponibles
 */
export async function getAllScreenshots(): Promise<Screenshot[]> {
  const screenshots: Screenshot[] = [];
  
  try {
    const files = await fs.readdir(SCREENSHOTS_BASE_PATH);
    
    for (const file of files) {
      // Filtrar solo imágenes (jpg, png, tga, etc)
      if (/\.(jpg|jpeg|png|tga|bmp)$/i.test(file)) {
        const filePath = path.join(SCREENSHOTS_BASE_PATH, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          screenshots.push({
            filename: file,
            path: filePath,
            url: `/api/screenshots/${encodeURIComponent(file)}`,
            timestamp: stats.mtime,
            size: stats.size,
          });
        } catch (err) {
          console.error(`Error reading screenshot ${file}:`, err);
        }
      }
    }
    
    // Ordenar por fecha (más recientes primero)
    screenshots.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
  } catch (err) {
    console.error('Error reading screenshots directory:', err);
  }
  
  return screenshots;
}

/**
 * Obtiene screenshots paginadas
 */
export async function getScreenshotsPaginated(page: number = 1, limit: number = 20): Promise<{
  screenshots: Screenshot[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const allScreenshots = await getAllScreenshots();
  const total = allScreenshots.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const end = start + limit;
  
  return {
    screenshots: allScreenshots.slice(start, end),
    total,
    page,
    totalPages,
  };
}

/**
 * Obtiene las últimas N screenshots
 */
export async function getLatestScreenshots(limit: number = 12): Promise<Screenshot[]> {
  const allScreenshots = await getAllScreenshots();
  return allScreenshots.slice(0, limit);
}

/**
 * Obtiene el path de una screenshot por nombre
 */
export async function getScreenshotPath(filename: string): Promise<string | null> {
  try {
    const filePath = path.join(SCREENSHOTS_BASE_PATH, filename);
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Extrae información del nombre del archivo de screenshot
 * Formato esperado: {type}-{player}-{map}-{YYYY}_{MM}_{DD}-{HH}_{MM}_{SS}.jpg
 * Ejemplo: CTF-Yim-Deadsphere-2026_02_13-20_45_42.jpg
 */
interface ParsedScreenshot {
  type: string;
  map: string;
  date: Date;
}

function parseScreenshotFilename(filename: string): ParsedScreenshot | null {
  // Formato: TYPE-PLAYER-MAP-YYYY_MM_DD-HH_MM_SS.ext
  // Captura: tipo de juego, mapa, y fecha/hora
  const regex = /^([A-Z]+)-[^-]+-([a-zA-Z0-9_]+)-(\d{4})_(\d{2})_(\d{2})-(\d{2})_(\d{2})_(\d{2})/;
  const match = filename.match(regex);
  
  if (!match) return null;
  
  const [, type, map, year, month, day, hour, minute, second] = match;
  
  return {
    type,
    map,
    date: new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`),
  };
}

/**
 * Obtiene screenshots correlacionadas con una partida
 * Busca por mapa, tipo de juego y hora similar (±6 minutos)
 */
export async function getScreenshotsByMatch(
  matchType: string,
  matchMap: string,
  matchDatetime: string,
  timeWindowMinutes: number = 6
): Promise<Screenshot[]> {
  const allScreenshots = await getAllScreenshots();
  
  // Normalizar el nombre del mapa (quitar guiones bajos, espacios, case-insensitive)
  const normalizeMapName = (map: string) => {
    return map.toLowerCase().replace(/[_\s-]/g, '');
  };
  
  const normalizedMatchMap = normalizeMapName(matchMap);
  
  // Parsear la fecha de la partida
  // matchDatetime format: "2026/02/13 20:49:38" o "13/02/26 17:59"
  let matchDate: Date;
  
  try {
    // Intentar ambos formatos
    const parts = matchDatetime.split(' ');
    if (parts.length < 2) return [];
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length < 3 || timeParts.length < 2) return [];
    
    let day: number, month: number, year: number;
    
    // Detectar formato: YYYY/MM/DD o DD/MM/YY
    if (dateParts[0].length === 4) {
      // Formato: YYYY/MM/DD
      year = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]);
      day = parseInt(dateParts[2]);
    } else {
      // Formato: DD/MM/YY
      day = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]);
      year = 2000 + parseInt(dateParts[2]);
    }
    
    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);
    const second = timeParts[2] ? parseInt(timeParts[2]) : 0;
    
    matchDate = new Date(year, month - 1, day, hour, minute, second);
  } catch (error) {
    console.error("Error parsing match datetime:", matchDatetime, error);
    return [];
  }
  
  const windowStart = new Date(matchDate.getTime() - timeWindowMinutes * 60 * 1000);
  const windowEnd = new Date(matchDate.getTime() + timeWindowMinutes * 60 * 1000);
  
  console.log(`Buscando screenshots correlacionadas:`, {
    type: matchType,
    map: matchMap,
    normalizedMap: normalizedMatchMap,
    matchTime: matchDate.toISOString(),
    matchTimeLocal: matchDate.toString(),
    window: `${windowStart.toISOString()} - ${windowEnd.toISOString()}`,
  });
  
  console.log(`Total screenshots disponibles: ${allScreenshots.length}`);
  
  const correlatedScreenshots = allScreenshots.filter(screenshot => {
    const parsed = parseScreenshotFilename(screenshot.filename);
    
    if (!parsed) {
      console.log(`❌ No se pudo parsear: ${screenshot.filename}`);
      return false;
    }
    
    // Comparar tipo de juego (case-insensitive)
    const typeMatch = parsed.type.toLowerCase() === matchType.toLowerCase();
    if (!typeMatch) {
      console.log(`❌ Tipo no coincide: ${screenshot.filename} (screenshot: ${parsed.type}, match: ${matchType})`);
      return false;
    }
    
    // Comparar mapa (case-insensitive, sin guiones bajos ni espacios)
    const normalizedScreenshotMap = normalizeMapName(parsed.map);
    const mapMatch = normalizedScreenshotMap === normalizedMatchMap;
    if (!mapMatch) {
      console.log(`❌ Mapa no coincide: ${screenshot.filename} (screenshot: ${parsed.map} → ${normalizedScreenshotMap}, match: ${matchMap} → ${normalizedMatchMap})`);
      return false;
    }
    
    // Comparar fecha dentro de la ventana de tiempo
    // Usar timestamp (fecha de modificación) en lugar de la fecha del nombre
    // porque la captura se toma durante el juego pero se guarda al finalizar
    if (!screenshot.timestamp) {
      console.log(`❌ Sin timestamp: ${screenshot.filename}`);
      return false;
    }
    
    const screenshotTime = screenshot.timestamp;
    const timeMatch = screenshotTime >= windowStart && screenshotTime <= windowEnd;
    
    if (timeMatch) {
      const timeDiffSeconds = Math.abs(screenshotTime.getTime() - matchDate.getTime()) / 1000;
      console.log(`✅ COINCIDENCIA: ${screenshot.filename} (diff: ${timeDiffSeconds.toFixed(0)}s, timestamp: ${screenshotTime.toISOString()})`);
      return true;
    } else {
      const timeDiffMinutes = Math.abs(screenshotTime.getTime() - matchDate.getTime()) / 60000;
      console.log(`❌ Fuera de ventana temporal: ${screenshot.filename} (diff: ${timeDiffMinutes.toFixed(2)} min, timestamp: ${screenshotTime.toISOString()})`);
    }
    
    return false;
  });
  
  console.log(`Capturas encontradas: ${correlatedScreenshots.length}`);
  
  // Ordenar por cercanía a la fecha de la partida (usando timestamp de modificación)
  correlatedScreenshots.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    
    const diff_a = Math.abs(a.timestamp.getTime() - matchDate.getTime());
    const diff_b = Math.abs(b.timestamp.getTime() - matchDate.getTime());
    
    return diff_a - diff_b;
  });
  
  return correlatedScreenshots;
}

/**
 * Busca screenshots simples por nombre de mapa
 * Retorna hasta 3 capturas más recientes que coincidan con el mapa
 */
export async function getScreenshotsByMapName(mapName: string): Promise<Screenshot[]> {
  const allScreenshots = await getAllScreenshots();
  
  // Normalizar nombre del mapa (quitar guiones bajos, guiones, espacios, case-insensitive)
  const normalizeMapName = (map: string) => {
    return map.toLowerCase().replace(/[_\s-]/g, '');
  };
  
  const normalizedMapName = normalizeMapName(mapName);
  
  // Filtrar screenshots que contengan el nombre del mapa normalizado
  const matchingScreenshots = allScreenshots.filter(screenshot => {
    const normalizedFilename = normalizeMapName(screenshot.filename);
    return normalizedFilename.includes(normalizedMapName);
  });
  
  // Retornar las 3 más recientes
  return matchingScreenshots.slice(0, 3);
}
