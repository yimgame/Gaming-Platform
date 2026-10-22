/**
 * Hora de las partidas en hora de Buenos Aires (UTC-3, sin horario de verano).
 *
 * Los XML de stats de CPMA traen `datetime` en la hora del sistema donde corría el server:
 *  - hasta junio 2026 el server corría en Windows con hora argentina  -> ya está en hora AR
 *  - desde la migración a Docker (LXC 101, agosto 2026) los containers corren en UTC
 *    (tienen TZ=America/Argentina/Buenos_Aires pero la imagen no trae tzdata) -> está en UTC
 * Verificado 2026-10-22 comparando `datetime` con la fecha de modificación de los ~60.000 XML:
 * todo lo anterior a 2026-07 da -3 h y todo lo posterior da 0 h.
 * Los datos se guardan tal cual vienen; esto los normaliza para mostrar y para comparar con
 * los nombres de demos/capturas (que los clientes graban en hora local).
 */
const CORTE_UTC = new Date(Date.UTC(2026, 6, 1, 0, 0, 0)); // 2026-07-01
const OFFSET_AR_MS = 3 * 60 * 60 * 1000;

const dos = (n: number) => String(n).padStart(2, "0");

function partes(datetime: string) {
  const m = (datetime || "").match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, a, b, c, hh, mi, ss] = m;
  const [anio, mes, dia] = a.length === 4 ? [+a, +b, +c] : [2000 + +c, +b, +a];
  return { anio, mes, dia, hh: +hh, mi: +mi, ss: +(ss || 0) };
}

/** "AAAA/MM/DD HH:MM:SS" tal como vino del XML -> mismo formato en hora de Buenos Aires. */
export function horaArgentina(datetime: string): string {
  const p = partes(datetime);
  if (!p) return datetime;
  let t = Date.UTC(p.anio, p.mes - 1, p.dia, p.hh, p.mi, p.ss);
  if (t >= CORTE_UTC.getTime()) t -= OFFSET_AR_MS;          // venía en UTC
  const d = new Date(t);
  return `${d.getUTCFullYear()}/${dos(d.getUTCMonth() + 1)}/${dos(d.getUTCDate())} ` +
    `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())}`;
}

/**
 * Inverso, para filtrar por `played_at` (que está guardado como vino): una fecha/hora de Buenos Aires
 * -> la hora "cruda" que tendría guardada esa partida.
 */
export function crudoDesdeArgentina(anio: number, mes: number, dia: number, hh = 0, mi = 0, ss = 0): Date {
  let t = Date.UTC(anio, mes - 1, dia, hh, mi, ss);
  if (t + OFFSET_AR_MS >= CORTE_UTC.getTime()) t += OFFSET_AR_MS;
  const d = new Date(t);
  // played_at es "timestamp without time zone": se compara con un Date local del proceso (que corre en UTC)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

/**
 * ¿La hora de un archivo (del nombre TIPO-...-AAAA_MM_DD-HH_MM_SS) coincide con la de la partida?
 * La partida viene en hora de Buenos Aires; el juego nombra demos/capturas a veces en hora local y a
 * veces en UTC, así que se acepta la misma hora o ±3 h.
 */
export function enVentanaArOUtc(archivo: Date, partida: Date, ventanaMin: number): boolean {
  const dif = (archivo.getTime() - partida.getTime()) / 60000;
  return [0, 180, -180].some((h) => Math.abs(dif - h) <= ventanaMin);
}
