/**
 * Subida de demos y capturas por los propios jugadores (sin token de admin).
 *
 * El navegador solo PROPONE qué archivo va con qué partida; acá se vuelve a validar todo:
 *  - la partida existe y el nombre que escribió el jugador jugó en ella
 *  - captura: es una imagen de verdad (JPG/PNG/TGA/BMP, se leen los bytes, no la extensión), de
 *    tamaño razonable, y su nombre (TIPO-...-mapa-AAAA_MM_DD-HH_MM_SS) coincide con mapa, tipo y hora
 *  - demo: se decodifica el gamestate (q3-demo.ts) y tiene que ser del mismo mapa, de uno de NUESTROS
 *    servidores y con los mismos jugadores; además se sabe quién la grabó (POV)
 *  - no se repite el mismo archivo (sha256) en la misma partida
 *  - límite de subidas por IP y de espacio total
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pool } from "./db";
import { leerDemoQ3, limpiarNombreQ3, type DemoInfo } from "./q3-demo";
import { horaArgentina } from "./hora-ar";

// ------------------------------------------------------------------ configuración
export const MAX_DEMO_BYTES = 80 * 1024 * 1024;
export const MAX_CAPTURA_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_JUGADORES_BYTES = 10 * 1024 * 1024 * 1024;     // 10 GB entre todo lo que suben los jugadores
const VENTANA_MIN = 10;                                            // tolerancia de hora (minutos)
// sv_hostname de nuestros servers ("The Meg & Yim ...", "Meg & Yim - CTF - Server")
const SERVIDOR_NUESTRO = new RegExp(process.env.DEMO_SERVIDOR_REGEX || "meg.*yim", "i");

export function limpiarNombre(nombre: string): string {
  return limpiarNombreQ3(nombre || "").toLowerCase().replace(/\s+/g, " ").trim();
}

const normMapa = (v: string) => (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normTipo = (v: string) => (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ------------------------------------------------------------------ partidas de un jugador
export interface PartidaJugador {
  id: string;
  datetime: string;
  map: string;
  type: string;
  duration: number;
  jugadores: string[];
  archivos: { id: string; kind: string; filename: string; pov: string | null; uploadedBy: string | null }[];
}

// misma expresión que el índice stats_players_nombre_limpio_idx (tiene que coincidir textualmente para que lo use)
export const NOMBRE_LIMPIO_SQL = (col: string) => `lower(btrim(regexp_replace(${col}, '\\^(x[0-9a-fA-F]{6}|.)', '', 'g')))`;

export async function partidasDeJugador(nombre: string, limite = 300): Promise<PartidaJugador[]> {
  const limpio = limpiarNombre(nombre);
  if (!limpio) return [];
  const { rows } = await pool.query(
    `SELECT m.match_id, m.datetime, m.map, m.type, m.duration
       FROM stats_matches m
      WHERE EXISTS (SELECT 1 FROM stats_players p
                     WHERE p.match_id = m.match_id
                       AND ${NOMBRE_LIMPIO_SQL("p.name")} = $1)
      ORDER BY m.played_at DESC
      LIMIT $2`,
    [limpio, limite],
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.match_id);
  const [jug, arch] = await Promise.all([
    pool.query(`SELECT match_id, name FROM stats_players WHERE match_id = ANY($1)`, [ids]),
    pool.query(`SELECT id, match_id, kind, filename, pov, uploaded_by FROM match_assets WHERE match_id = ANY($1)`, [ids]),
  ]);
  const porPartida = new Map<string, PartidaJugador>();
  for (const r of rows) {
    porPartida.set(r.match_id, { id: r.match_id, datetime: horaArgentina(r.datetime), map: r.map, type: r.type, duration: r.duration, jugadores: [], archivos: [] });
  }
  for (const j of jug.rows) porPartida.get(j.match_id)?.jugadores.push(limpiarNombreQ3(j.name));
  for (const a of arch.rows) {
    porPartida.get(a.match_id)?.archivos.push({ id: a.id, kind: a.kind, filename: a.filename, pov: a.pov, uploadedBy: a.uploaded_by });
  }
  return Array.from(porPartida.values());
}

async function partidaPorId(matchId: string) {
  const { rows } = await pool.query(`SELECT match_id, datetime, map, type FROM stats_matches WHERE match_id = $1`, [matchId]);
  if (!rows.length) return null;
  const jug = await pool.query(`SELECT name FROM stats_players WHERE match_id = $1`, [matchId]);
  return { ...rows[0], jugadores: jug.rows.map((r) => limpiarNombre(r.name)) as string[] };
}

// ------------------------------------------------------------------ fechas
/** datetime de la partida (crudo de la DB) -> Date en hora de Buenos Aires (como los nombres de archivo) */
export function fechaPartida(datetime: string): Date | null {
  const m = horaArgentina(datetime || "").match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  let [, a, b, c] = m;
  const [, , , , hh, mi, ss] = m;
  const [anio, mes, dia] = a.length === 4 ? [+a, +b, +c] : [2000 + +c, +b, +a];
  return new Date(anio, mes - 1, dia, +hh, +mi, +(ss || 0));
}

/** TIPO-...-AAAA_MM_DD-HH_MM_SS.ext (formato de CPMA/OSP para demos y capturas automáticas) */
export function fechaArchivo(nombre: string): { tipo: string; fecha: Date } | null {
  const m = path.basename(nombre).match(/^([A-Z0-9]+)-.*-(\d{4})_(\d{2})_(\d{2})-(\d{2})_(\d{2})_(\d{2})(?:\.[^.]+)?$/i);
  if (!m) return null;
  const [, tipo, a, me, d, h, mi, s] = m;
  return { tipo, fecha: new Date(+a, +me - 1, +d, +h, +mi, +s) };
}

/** ¿Las horas coinciden? Acepta diferencias de horas enteras (jugador en otro huso horario). */
export function horaCoincide(archivo: Date, partida: Date, ventanaMin = VENTANA_MIN): boolean {
  const dif = (archivo.getTime() - partida.getTime()) / 60000;
  for (let h = -12; h <= 12; h++) if (Math.abs(dif - h * 60) <= ventanaMin) return true;
  return false;
}

// ------------------------------------------------------------------ validadores
export interface InfoCaptura { formato: string; ancho: number; alto: number }

/** Lee el encabezado real de la imagen (no confía en la extensión). Tira Error si no es una imagen válida. */
export function validarCaptura(buf: Buffer): InfoCaptura {
  let r: InfoCaptura | null = null;
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString("latin1", 1, 4) === "PNG") {
    r = { formato: "png", ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
    if (buf.toString("latin1", 12, 16) !== "IHDR") throw new Error("PNG dañado");
  } else if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    for (let i = 2; i + 9 < buf.length;) {                      // buscar el SOF con el tamaño
      if (buf[i] !== 0xff) { i++; continue; }
      const marca = buf[i + 1];
      if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
      const largo = buf.readUInt16BE(i + 2);
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
        r = { formato: "jpg", alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
        break;
      }
      i += 2 + largo;
    }
    if (!r) throw new Error("JPG sin encabezado de tamaño");
    let fin = buf.length - 1;
    while (fin > 0 && buf[fin] === 0) fin--;                     // algunos programas rellenan con ceros
    if (!(buf[fin - 1] === 0xff && buf[fin] === 0xd9)) throw new Error("JPG incompleto (cortado)");
  } else if (buf.length > 26 && buf.toString("latin1", 0, 2) === "BM") {
    r = { formato: "bmp", ancho: buf.readInt32LE(18), alto: Math.abs(buf.readInt32LE(22)) };
  } else if (buf.length > 18 && [2, 3, 10, 11].includes(buf[2]) && buf[1] === 0 && [24, 32, 8].includes(buf[16])) {
    // TGA (las capturas viejas de Quake 3): sin firma, se valida el encabezado y que el tamaño cierre
    const ancho = buf.readUInt16LE(12), alto = buf.readUInt16LE(14);
    const crudo = 18 + buf[0] + ancho * alto * (buf[16] / 8);
    if (buf[2] < 9 && buf.length < crudo) throw new Error("TGA incompleto");
    r = { formato: "tga", ancho, alto };
  }
  if (!r) throw new Error("no es una imagen (JPG, PNG, TGA o BMP)");
  if (r.ancho < 320 || r.alto < 200 || r.ancho > 8192 || r.alto > 8192) {
    throw new Error(`tamaño de imagen raro para una captura del juego (${r.ancho}x${r.alto})`);
  }
  return r;
}

export interface ResultadoValidacion { pov: string | null; detalle: string }

/**
 * Valida que el archivo sea de ESA partida. Tira Error con un motivo entendible si no.
 */
export async function validarParaPartida(
  kind: "demo" | "screenshot", buf: Buffer, nombreArchivo: string, matchId: string, jugador: string,
): Promise<ResultadoValidacion & { partida: { map: string; type: string } }> {
  const partida = await partidaPorId(matchId);
  if (!partida) throw new Error("la partida no existe");
  const quien = limpiarNombre(jugador);
  if (!quien || !partida.jugadores.includes(quien)) throw new Error(`"${jugador}" no figura en esa partida`);
  const fp = fechaPartida(partida.datetime);
  const fa = fechaArchivo(nombreArchivo);

  if (kind === "screenshot") {
    const info = validarCaptura(buf);
    if (!fa) throw new Error("el nombre de la captura no tiene la fecha del juego (TIPO-...-AAAA_MM_DD-HH_MM_SS)");
    if (!normMapa(nombreArchivo).includes(normMapa(partida.map))) throw new Error(`la captura no es del mapa ${partida.map}`);
    if (normTipo(fa.tipo) !== normTipo(partida.type) && !normTipo(partida.type).startsWith(normTipo(fa.tipo))) {
      throw new Error(`la captura es de ${fa.tipo} y la partida es ${partida.type}`);
    }
    if (!fp || !horaCoincide(fa.fecha, fp)) throw new Error("la hora de la captura no coincide con la partida");
    return { pov: null, detalle: `${info.formato.toUpperCase()} ${info.ancho}x${info.alto}`, partida };
  }

  // demo: el contenido manda
  let d: DemoInfo;
  try {
    d = leerDemoQ3(buf);
  } catch (e) {
    throw new Error(`no es una demo válida de Quake 3 (${(e as Error).message})`);
  }
  if (normMapa(d.mapa) !== normMapa(partida.map)) throw new Error(`la demo es del mapa ${d.mapa}, no de ${partida.map}`);
  if (!SERVIDOR_NUESTRO.test(d.servidorLimpio.replace(/[^a-z0-9&]/gi, ""))) {
    throw new Error(`la demo es de otro servidor ("${d.servidorLimpio}")`);
  }
  const enDemo = new Set(d.jugadores.map((j) => limpiarNombre(j.nombreLimpio)));
  const comunes = partida.jugadores.filter((j: string) => enDemo.has(j)).length;
  if (comunes < Math.max(1, Math.ceil(partida.jugadores.length / 2))) {
    throw new Error("los jugadores de la demo no coinciden con los de la partida");
  }
  if (fa && fp && !horaCoincide(fa.fecha, fp)) throw new Error("la fecha del nombre de la demo no coincide con la partida");
  const pov = d.grabadaPor ? d.grabadaPor.nombreLimpio : null;
  return { pov, detalle: `${d.mapa} · ${d.servidorLimpio} · ${d.jugadores.length} jugadores`, partida };
}

// ------------------------------------------------------------------ duplicados, cupo y límite por IP
export const sha256 = (buf: Buffer) => crypto.createHash("sha256").update(buf).digest("hex");

export async function yaSubido(matchId: string, hash: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM match_assets WHERE match_id = $1 AND sha256 = $2 LIMIT 1`, [matchId, hash]);
  return rows.length > 0;
}

export function espacioUsado(dirs: string[]): number {
  let total = 0;
  for (const d of dirs) {
    try {
      for (const f of fs.readdirSync(d)) total += fs.statSync(path.join(d, f)).size;
    } catch { /* carpeta todavía no creada */ }
  }
  return total;
}
export const hayEspacio = (dirs: string[], extra: number) => espacioUsado(dirs) + extra <= MAX_TOTAL_JUGADORES_BYTES;

const subidasPorIp = new Map<string, number[]>();
/** 60 archivos cada 30 min por IP */
export function dentroDelLimite(ip: string, max = 60, ventanaMs = 30 * 60 * 1000): boolean {
  const ahora = Date.now();
  const lista = (subidasPorIp.get(ip) || []).filter((t) => ahora - t < ventanaMs);
  if (lista.length >= max) {
    subidasPorIp.set(ip, lista);
    return false;
  }
  lista.push(ahora);
  subidasPorIp.set(ip, lista);
  if (subidasPorIp.size > 5000) subidasPorIp.clear();
  return true;
}
