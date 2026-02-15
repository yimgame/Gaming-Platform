import { promises as fs } from "fs";
import * as path from "path";

const DEMOS_BASE_PATH = process.env.DEMOS_PATH || "G:\\Games\\Quake3\\cpma\\demos";

export interface DemoFile {
  filename: string;
  path: string;
  url: string;
  timestamp?: Date;
  size?: number;
  protocol?: string;
}

interface ParsedDemo {
  type: string;
  date: Date;
}

function getDemoProtocol(filename: string): string | undefined {
  const match = filename.match(/\.dm_(\d+)/i);
  return match ? match[1] : undefined;
}

function normalizeMatchType(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeMapName(value: string): string {
  return value.toLowerCase().replace(/[_\s-]/g, "");
}

function parseMatchDatetime(matchDatetime: string): Date | null {
  try {
    const parts = matchDatetime.split(" ");
    if (parts.length < 2) return null;

    const dateParts = parts[0].split("/");
    const timeParts = parts[1].split(":");

    if (dateParts.length < 3 || timeParts.length < 2) return null;

    let day: number;
    let month: number;
    let year: number;

    if (dateParts[0].length === 4) {
      year = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]);
      day = parseInt(dateParts[2]);
    } else {
      day = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]);
      year = 2000 + parseInt(dateParts[2]);
    }

    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);
    const second = timeParts[2] ? parseInt(timeParts[2]) : 0;

    return new Date(year, month - 1, day, hour, minute, second);
  } catch {
    return null;
  }
}

function parseDemoFilename(filename: string): ParsedDemo | null {
  const regex = /^([A-Z0-9]+)-.*-(\d{4})_(\d{2})_(\d{2})-(\d{2})_(\d{2})_(\d{2})(?:\.[^.]+)?$/i;
  const match = filename.match(regex);

  if (!match) return null;

  const [, type, year, month, day, hour, minute, second] = match;

  return {
    type,
    date: new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ),
  };
}

export async function getAllDemos(): Promise<DemoFile[]> {
  const demos: DemoFile[] = [];

  try {
    const files = await fs.readdir(DEMOS_BASE_PATH);

    for (const file of files) {
      if (/\.dm_\d+$/i.test(file)) {
        const filePath = path.join(DEMOS_BASE_PATH, file);

        try {
          const stats = await fs.stat(filePath);
          demos.push({
            filename: file,
            path: filePath,
            url: `/api/demos/${encodeURIComponent(file)}`,
            timestamp: stats.mtime,
            size: stats.size,
            protocol: getDemoProtocol(file),
          });
        } catch (err) {
          console.error(`Error reading demo ${file}:`, err);
        }
      }
    }

    demos.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  } catch (err) {
    console.error("Error reading demos directory:", err);
  }

  return demos;
}

export async function getDemoPath(filename: string): Promise<string | null> {
  try {
    const filePath = path.join(DEMOS_BASE_PATH, filename);
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

export async function getDemosByMatch(
  matchType: string,
  matchMap: string,
  matchDatetime: string,
  timeWindowMinutes: number = 4,
  pinnedFilenames: string[] = []
): Promise<DemoFile[]> {
  const allDemos = await getAllDemos();
  const pinnedSet = new Set(pinnedFilenames.map(filename => filename.toLowerCase()));
  const pinnedMatches = allDemos.filter(demo => pinnedSet.has(demo.filename.toLowerCase()));

  const matchDate = parseMatchDatetime(matchDatetime);
  if (!matchDate) {
    return pinnedMatches;
  }

  const windowStart = new Date(matchDate.getTime() - timeWindowMinutes * 60 * 1000);
  const windowEnd = new Date(matchDate.getTime() + timeWindowMinutes * 60 * 1000);
  const normalizedMatchMap = normalizeMapName(matchMap);
  const normalizedMatchType = normalizeMatchType(matchType);

  const autoMatches = allDemos.filter(demo => {
    if (pinnedSet.has(demo.filename.toLowerCase())) return false;

    const parsed = parseDemoFilename(demo.filename);
    if (!parsed) return false;

    const demoType = normalizeMatchType(parsed.type);
    const typeMatch = demoType === normalizedMatchType
      || demoType.startsWith(normalizedMatchType)
      || normalizedMatchType.startsWith(demoType);

    if (!typeMatch) return false;

    const normalizedFilename = normalizeMapName(demo.filename);
    const mapMatch = normalizedFilename.includes(normalizedMatchMap);
    if (!mapMatch) return false;

    const demoTime = parsed.date || demo.timestamp;
    return demoTime >= windowStart && demoTime <= windowEnd;
  });

  autoMatches.sort((a, b) => {
    const dateA = a.timestamp || new Date(0);
    const dateB = b.timestamp || new Date(0);
    return Math.abs(dateA.getTime() - matchDate.getTime()) - Math.abs(dateB.getTime() - matchDate.getTime());
  });

  const merged = [...pinnedMatches, ...autoMatches];
  const seen = new Set<string>();

  return merged.filter(demo => {
    const key = demo.filename.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
