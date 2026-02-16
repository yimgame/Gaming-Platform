import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

export interface BackupSettings {
  enabled: boolean;
  maxCopies: number;
  intervalDays: number;
  lastBackupAt: string | null;
}

export interface BackupEntry {
  scope: "default" | "manual";
  protectedFromRotation: boolean;
  filename: string;
  fullPath: string;
  sizeBytes: number;
  createdAt: string;
}

interface BackupManifestFile {
  path: string;
  sha256: string;
  sizeBytes: number;
}

interface BackupManifest {
  formatVersion: 1;
  files: BackupManifestFile[];
}

export interface BackupRunResult {
  ok: boolean;
  filename?: string;
  warnings: string[];
  error?: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const BACKUPS_MANUAL_DIR = path.join(DATA_DIR, "backups-manual");
const SETTINGS_PATH = path.join(DATA_DIR, "backup-settings.json");

const DEFAULT_SETTINGS: BackupSettings = {
  enabled: true,
  maxCopies: 3,
  intervalDays: 1,
  lastBackupAt: null,
};

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

const sanitizePositiveInt = (value: unknown, fallback: number, min: number, max: number) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
};

const runCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
};

const ensureDirs = async () => {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
  await fs.promises.mkdir(BACKUPS_MANUAL_DIR, { recursive: true });
};

const loadSettings = async (): Promise<BackupSettings> => {
  await ensureDirs();

  try {
    const raw = await fs.promises.readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<BackupSettings>;

    return {
      enabled: Boolean(parsed.enabled),
      maxCopies: sanitizePositiveInt(parsed.maxCopies, DEFAULT_SETTINGS.maxCopies, 1, 30),
      intervalDays: sanitizePositiveInt(parsed.intervalDays, DEFAULT_SETTINGS.intervalDays, 1, 365),
      lastBackupAt: typeof parsed.lastBackupAt === "string" ? parsed.lastBackupAt : null,
    };
  } catch {
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = async (settings: BackupSettings) => {
  await ensureDirs();
  await fs.promises.writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
};

const listBackupEntriesFromDir = async (
  dirPath: string,
  scope: "default" | "manual",
  protectedFromRotation: boolean,
): Promise<BackupEntry[]> => {
  const files = await fs.promises.readdir(dirPath);
  const entries: BackupEntry[] = [];

  for (const filename of files) {
    if (!filename.toLowerCase().endsWith(".zip")) continue;

    const fullPath = path.join(dirPath, filename);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) continue;

    entries.push({
      scope,
      protectedFromRotation,
      filename,
      fullPath,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return entries;
};

const listBackupEntries = async (): Promise<BackupEntry[]> => {
  await ensureDirs();
  const [defaultEntries, manualEntries] = await Promise.all([
    listBackupEntriesFromDir(BACKUPS_DIR, "default", false),
    listBackupEntriesFromDir(BACKUPS_MANUAL_DIR, "manual", true),
  ]);

  const merged = [...defaultEntries, ...manualEntries];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
};

const rotateBackups = async (maxCopies: number) => {
  const entries = await listBackupEntriesFromDir(BACKUPS_DIR, "default", false);
  const removable = entries.slice(maxCopies);

  for (const item of removable) {
    await fs.promises.unlink(item.fullPath).catch(() => undefined);
  }
};

const buildTimestamp = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
};

const zipDirectory = async (sourceDir: string, zipFilePath: string): Promise<void> => {
  const baseName = path.basename(sourceDir);
  const parentDir = path.dirname(sourceDir);

  if (process.platform === "win32") {
    const escapedSource = sourceDir.replace(/'/g, "''");
    const escapedZip = zipFilePath.replace(/'/g, "''");
    await runCommand("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -Path '${escapedSource}' -DestinationPath '${escapedZip}' -Force`,
    ]);
    return;
  }

  await runCommand("zip", ["-r", "-q", zipFilePath, baseName], { cwd: parentDir });
};

const unzipFile = async (zipFilePath: string, destinationDir: string): Promise<void> => {
  if (process.platform === "win32") {
    const escapedZip = zipFilePath.replace(/'/g, "''");
    const escapedDest = destinationDir.replace(/'/g, "''");
    await runCommand("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`,
    ]);
    return;
  }

  await runCommand("unzip", ["-o", zipFilePath, "-d", destinationDir]);
};

const toPosixRelative = (root: string, fullPath: string) => path.relative(root, fullPath).split(path.sep).join("/");

const collectFilesRecursive = async (rootDir: string): Promise<Array<{ fullPath: string; relativePath: string }>> => {
  const output: Array<{ fullPath: string; relativePath: string }> = [];

  const walk = async (dirPath: string) => {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      output.push({ fullPath, relativePath: toPosixRelative(rootDir, fullPath) });
    }
  };

  if (!fs.existsSync(rootDir)) {
    return [];
  }

  await walk(rootDir);
  output.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return output;
};

const fileSha256 = async (filePath: string): Promise<string> => {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
};

const createBackupManifest = async (backupRoot: string): Promise<BackupManifest> => {
  const files = await collectFilesRecursive(backupRoot);
  const manifestFiles: BackupManifestFile[] = [];

  for (const file of files) {
    if (file.relativePath === ".backup-manifest.json") continue;
    const stat = await fs.promises.stat(file.fullPath);
    manifestFiles.push({
      path: file.relativePath,
      sha256: await fileSha256(file.fullPath),
      sizeBytes: stat.size,
    });
  }

  return {
    formatVersion: 1,
    files: manifestFiles,
  };
};

const validateBackupExtractedContent = async (backupRoot: string): Promise<{ valid: boolean; error?: string }> => {
  const dataDir = path.join(backupRoot, "data");
  const sqlFile = path.join(backupRoot, "database.sql");
  const manifestPath = path.join(backupRoot, ".backup-manifest.json");

  if (!fs.existsSync(dataDir) || !(await fs.promises.stat(dataDir)).isDirectory()) {
    return { valid: false, error: "Estructura inválida: falta carpeta backup/data" };
  }

  if (!fs.existsSync(sqlFile)) {
    return { valid: false, error: "Estructura inválida: falta backup/database.sql" };
  }

  if (!fs.existsSync(manifestPath)) {
    return { valid: false, error: "Backup inválido: falta .backup-manifest.json" };
  }

  let manifest: BackupManifest;
  try {
    const raw = await fs.promises.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw) as BackupManifest;
  } catch {
    return { valid: false, error: "Manifest inválido: no se pudo parsear" };
  }

  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files)) {
    return { valid: false, error: "Manifest inválido: versión o estructura no compatible" };
  }

  const actualFiles = await collectFilesRecursive(backupRoot);
  const actualRelSet = new Set(actualFiles.map((file) => file.relativePath));
  const manifestRelSet = new Set(manifest.files.map((item) => item.path));

  for (const expectedPath of Array.from(manifestRelSet)) {
    if (!actualRelSet.has(expectedPath)) {
      return { valid: false, error: `Manifest inválido: falta archivo ${expectedPath}` };
    }
  }

  const nonManifestActualFiles = actualFiles
    .map((file) => file.relativePath)
    .filter((item) => item !== ".backup-manifest.json");

  for (const actualPath of nonManifestActualFiles) {
    if (!manifestRelSet.has(actualPath)) {
      return { valid: false, error: `Manifest inválido: archivo extra no permitido ${actualPath}` };
    }
  }

  for (const item of manifest.files) {
    const fullPath = path.join(backupRoot, item.path);
    const stat = await fs.promises.stat(fullPath);
    if (stat.size !== item.sizeBytes) {
      return { valid: false, error: `Contenido inválido: tamaño distinto en ${item.path}` };
    }

    const hash = await fileSha256(fullPath);
    if (hash !== item.sha256) {
      return { valid: false, error: `Contenido inválido: hash distinto en ${item.path}` };
    }
  }

  return { valid: true };
};

const ensureSafeZipFilename = (filename: string) => {
  if (!filename || filename.includes("/") || filename.includes("\\") || !filename.toLowerCase().endsWith(".zip")) {
    return false;
  }

  return /^[a-zA-Z0-9._-]+\.zip$/.test(filename);
};

const resolveBackupPath = async (scope: "default" | "manual", filename: string): Promise<string | null> => {
  if (!ensureSafeZipFilename(filename)) {
    return null;
  }

  const root = scope === "manual" ? BACKUPS_MANUAL_DIR : BACKUPS_DIR;
  const fullPath = path.join(root, filename);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fullPath;
};

const createDbDump = async (outputPath: string, warnings: string[]) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    warnings.push("DATABASE_URL no definida, backup sin dump SQL.");
    return;
  }

  try {
    await runCommand("pg_dump", ["--dbname", databaseUrl, "--no-owner", "--no-privileges", "--file", outputPath]);
  } catch (error) {
    warnings.push(`No se pudo ejecutar pg_dump (${error instanceof Error ? error.message : String(error)}).`);
  }
};

const restoreDbDump = async (sqlPath: string, warnings: string[]) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    warnings.push("DATABASE_URL no definida, restore sin import SQL.");
    return;
  }

  try {
    await runCommand("psql", ["--dbname", databaseUrl, "-f", sqlPath]);
  } catch (error) {
    warnings.push(`No se pudo restaurar SQL con psql (${error instanceof Error ? error.message : String(error)}).`);
  }
};

export async function getBackupStatus() {
  const settings = await loadSettings();
  const entries = await listBackupEntries();
  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const nextBackupAt =
    settings.enabled && lastBackup
      ? new Date(lastBackup.getTime() + settings.intervalDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  return {
    ...settings,
    running,
    copiesAvailable: entries.length,
    latestBackup: entries[0] || null,
    nextBackupAt,
  };
}

export async function listBackups() {
  const entries = await listBackupEntries();
  return entries.map(({ scope, protectedFromRotation, filename, sizeBytes, createdAt }) => ({
    scope,
    protectedFromRotation,
    filename,
    sizeBytes,
    createdAt,
  }));
}

export async function updateBackupSettings(input: Partial<BackupSettings>) {
  const current = await loadSettings();
  const next: BackupSettings = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    maxCopies: sanitizePositiveInt(input.maxCopies, current.maxCopies, 1, 30),
    intervalDays: sanitizePositiveInt(input.intervalDays, current.intervalDays, 1, 365),
    lastBackupAt: current.lastBackupAt,
  };

  await saveSettings(next);
  return getBackupStatus();
}

export async function setBackupsEnabled(enabled: boolean) {
  const current = await loadSettings();
  const next = { ...current, enabled };
  await saveSettings(next);
  return getBackupStatus();
}

export async function createBackupNow(): Promise<BackupRunResult> {
  if (running) {
    return {
      ok: false,
      warnings: [],
      error: "Ya hay un backup en ejecución",
    };
  }

  running = true;
  const warnings: string[] = [];
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "yim-backup-"));

  try {
    await ensureDirs();

    const stageRoot = path.join(tempRoot, "backup");
    await fs.promises.mkdir(stageRoot, { recursive: true });

    const dataSource = path.join(process.cwd(), "data");
    const dataTarget = path.join(stageRoot, "data");

    if (fs.existsSync(dataSource)) {
      await fs.promises.cp(dataSource, dataTarget, {
        recursive: true,
        force: true,
        filter: (src) => !src.includes(`${path.sep}backups${path.sep}`),
      });
    }

    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      await fs.promises.copyFile(envPath, path.join(stageRoot, ".env"));
    }

    await createDbDump(path.join(stageRoot, "database.sql"), warnings);

    const manifest = await createBackupManifest(stageRoot);
    await fs.promises.writeFile(
      path.join(stageRoot, ".backup-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf-8",
    );

    const fileName = `backup-${buildTimestamp()}.zip`;
    const fullZipPath = path.join(BACKUPS_DIR, fileName);
    await zipDirectory(stageRoot, fullZipPath);

    const settings = await loadSettings();
    const updatedSettings: BackupSettings = {
      ...settings,
      lastBackupAt: new Date().toISOString(),
    };

    await saveSettings(updatedSettings);
    await rotateBackups(updatedSettings.maxCopies);

    return {
      ok: true,
      filename: fileName,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      warnings,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    running = false;
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function restoreBackup(filename: string, confirmRestore: boolean): Promise<BackupRunResult> {
  return restoreBackupFromScope("default", filename, confirmRestore);
}

export async function restoreBackupFromScope(
  scope: "default" | "manual",
  filename: string,
  confirmRestore: boolean,
): Promise<BackupRunResult> {
  if (!confirmRestore) {
    return {
      ok: false,
      warnings: [],
      error: "CONFIRM_REQUIRED",
    };
  }

  if (!ensureSafeZipFilename(filename)) {
    return {
      ok: false,
      warnings: [],
      error: "INVALID_FILENAME",
    };
  }

  const backupPath = await resolveBackupPath(scope, filename);
  if (!backupPath) {
    return {
      ok: false,
      warnings: [],
      error: "BACKUP_NOT_FOUND",
    };
  }

  const warnings: string[] = [];
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "yim-restore-"));

  try {
    await unzipFile(backupPath, tempRoot);
    const extractedRoot = path.join(tempRoot, "backup");
    if (!fs.existsSync(extractedRoot)) {
      return {
        ok: false,
        warnings,
        error: "Estructura inválida: la raíz backup/ no existe",
      };
    }

    const validation = await validateBackupExtractedContent(extractedRoot);
    if (!validation.valid) {
      return {
        ok: false,
        warnings,
        error: validation.error || "Backup inválido",
      };
    }

    const backupData = path.join(extractedRoot, "data");
    if (fs.existsSync(backupData)) {
      await fs.promises.cp(backupData, path.join(process.cwd(), "data"), { recursive: true, force: true });
    } else {
      warnings.push("El backup no contiene carpeta data.");
    }

    const sqlDump = path.join(extractedRoot, "database.sql");
    if (fs.existsSync(sqlDump)) {
      await restoreDbDump(sqlDump, warnings);
    } else {
      warnings.push("El backup no contiene database.sql.");
    }

    return {
      ok: true,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      warnings,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function getBackupZipForDownload(scope: "default" | "manual", filename: string): Promise<string | null> {
  return resolveBackupPath(scope, filename);
}

export async function registerUploadedManualBackup(tempFilePath: string, originalName: string): Promise<BackupRunResult> {
  await ensureDirs();

  const safeName = (originalName || path.basename(tempFilePath)).replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalName = `${Date.now()}-${safeName.toLowerCase().endsWith(".zip") ? safeName : `${safeName}.zip`}`;
  const finalPath = path.join(BACKUPS_MANUAL_DIR, finalName);

  await fs.promises.rename(tempFilePath, finalPath);

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "yim-validate-upload-"));
  try {
    await unzipFile(finalPath, tempRoot);
    const extractedRoot = path.join(tempRoot, "backup");

    if (!fs.existsSync(extractedRoot)) {
      await fs.promises.unlink(finalPath).catch(() => undefined);
      return {
        ok: false,
        warnings: [],
        error: "Upload rechazado: debe contener carpeta raíz backup/",
      };
    }

    const validation = await validateBackupExtractedContent(extractedRoot);
    if (!validation.valid) {
      await fs.promises.unlink(finalPath).catch(() => undefined);
      return {
        ok: false,
        warnings: [],
        error: validation.error || "Upload rechazado por validación",
      };
    }

    return {
      ok: true,
      filename: finalName,
      warnings: [],
    };
  } catch (error) {
    await fs.promises.unlink(finalPath).catch(() => undefined);
    return {
      ok: false,
      warnings: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function startBackupsScheduler() {
  await ensureDirs();

  if (schedulerHandle) {
    return;
  }

  schedulerHandle = setInterval(async () => {
    try {
      const status = await getBackupStatus();
      if (!status.enabled || running) return;

      const now = Date.now();
      const last = status.lastBackupAt ? new Date(status.lastBackupAt).getTime() : 0;
      const intervalMs = status.intervalDays * 24 * 60 * 60 * 1000;

      if (!last || now - last >= intervalMs) {
        await createBackupNow();
      }
    } catch (error) {
      console.error("Backup scheduler error:", error);
    }
  }, 60 * 1000);
}
