/**
 * ¿Bot o humano? Clasificación de los nombres de jugador de las estadísticas de Quake 3.
 *
 * Los XML de stats de CPMA no dicen si un jugador es bot ni traen la IP. Lo que sí lo dice es el
 * games.log de cada server: cuando un bot entra, su línea `ClientUserinfoChanged` trae `\skill\<n>`
 * (la dificultad); la de un humano no. Se leen todos los games.log del share (instances/<server>/<mod>
 * y los de la época Windows en <mod>/games.log), de forma incremental (se guarda hasta qué byte se leyó),
 * y se cuenta cuántas veces apareció cada nombre como bot y como humano.
 * Para los nombres que no aparecen en ningún log se usa la lista de bots definidos en los pk3
 * (scripts/bots.txt y *.bot, en bot-names.ts).
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { BOT_NAMES } from "./bot-names";

export type PlayerKind = "humano" | "bot" | "desconocido";

const Q3_ROOT = process.env.Q3_ROOT || "/mnt/ssd-jellyfin/gamesrv/Quake3";
const ESTADO = path.resolve(process.cwd(), "data", "player-kinds.json");
const CADA_MS = 15 * 60 * 1000;

const BOTS_DEFINIDOS = new Set<string>(BOT_NAMES);

/** Mismo criterio que NOMBRE_LIMPIO_SQL: sin códigos de color, sin espacios en los bordes, minúsculas. */
export function nombreLimpio(nombre: string): string {
  return (nombre || "").replace(/\^(x[0-9a-fA-F]{6}|.)/g, "").trim().toLowerCase();
}

type Estado = { offsets: Record<string, number>; bot: Record<string, number>; humano: Record<string, number> };
let estado: Estado = { offsets: {}, bot: {}, humano: {} };
let cargado = false;
let leyendo: Promise<void> | null = null;
let ultimaLectura = 0;

function cargar() {
  if (cargado) return;
  cargado = true;
  try {
    estado = JSON.parse(fs.readFileSync(ESTADO, "utf8"));
  } catch {
    /* primera vez */
  }
}

function guardar() {
  try {
    fs.mkdirSync(path.dirname(ESTADO), { recursive: true });
    fs.writeFileSync(ESTADO + ".tmp", JSON.stringify(estado));
    fs.renameSync(ESTADO + ".tmp", ESTADO);
  } catch (e) {
    console.error("player-kinds: no se pudo guardar el estado", e);
  }
}

function logsDelShare(): string[] {
  const salida: string[] = [];
  const esLog = (n: string) => n.toLowerCase() === "games.log";
  const leerDir = (d: string) => {
    try {
      return fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const mod of leerDir(Q3_ROOT)) {
    if (!mod.isDirectory()) continue;
    const dirMod = path.join(Q3_ROOT, mod.name);
    if (mod.name === "instances") {
      for (const srv of leerDir(dirMod)) {
        if (!srv.isDirectory()) continue;
        for (const sub of leerDir(path.join(dirMod, srv.name))) {
          if (!sub.isDirectory()) continue;
          for (const f of leerDir(path.join(dirMod, srv.name, sub.name))) {
            if (f.isFile() && esLog(f.name)) salida.push(path.join(dirMod, srv.name, sub.name, f.name));
          }
        }
      }
      continue;
    }
    for (const f of leerDir(dirMod)) {
      if (f.isFile() && esLog(f.name)) salida.push(path.join(dirMod, f.name));
    }
  }
  return salida;
}

async function leerLog(archivo: string) {
  let tam: number;
  try {
    tam = fs.statSync(archivo).size;
  } catch {
    return;
  }
  let desde = estado.offsets[archivo] || 0;
  if (tam < desde) desde = 0;               // el log se rotó o se vació
  if (tam === desde) return;
  const flujo = fs.createReadStream(archivo, { start: desde, end: tam - 1, encoding: "latin1" });
  const lineas = readline.createInterface({ input: flujo, crlfDelay: Infinity });
  for await (const linea of lineas) {
    if (!linea.includes("ClientUserinfoChanged")) continue;
    const m = linea.match(/ClientUserinfoChanged: \d+ n\\([^\\]*)/);
    if (!m) continue;
    const n = nombreLimpio(m[1]);
    if (!n) continue;
    const tabla = linea.includes("\\skill\\") ? estado.bot : estado.humano;
    tabla[n] = (tabla[n] || 0) + 1;
  }
  estado.offsets[archivo] = tam;
}

/** Lee lo nuevo de los games.log (en segundo plano; como mucho una vez cada 15 min). */
export function actualizarClasificacion(forzar = false): Promise<void> {
  cargar();
  if (leyendo) return leyendo;
  if (!forzar && Date.now() - ultimaLectura < CADA_MS) return Promise.resolve();
  leyendo = (async () => {
    const inicio = Date.now();
    for (const archivo of logsDelShare()) {
      try {
        await leerLog(archivo);
      } catch (e) {
        console.error("player-kinds: error leyendo", archivo, e);
      }
    }
    ultimaLectura = Date.now();
    guardar();
    console.log(`player-kinds: logs leídos en ${Math.round((Date.now() - inicio) / 1000)} s ` +
      `(${Object.keys(estado.bot).length} bots, ${Object.keys(estado.humano).length} humanos)`);
  })().finally(() => {
    leyendo = null;
  });
  return leyendo;
}

export function tipoDeJugador(nombre: string): PlayerKind {
  cargar();
  const n = nombreLimpio(nombre);
  const comoHumano = estado.humano[n] || 0;
  const comoBot = estado.bot[n] || 0;
  if (comoHumano > comoBot) return "humano";          // p. ej. un humano que usó el nombre de un bot alguna vez
  if (comoBot > 0 || BOTS_DEFINIDOS.has(n)) return "bot";
  return "desconocido";
}
