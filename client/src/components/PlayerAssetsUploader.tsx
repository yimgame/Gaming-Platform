import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FolderOpen, Upload, Info } from "lucide-react";

/*
 * "Subir mis demos y capturas": el jugador escribe su nombre, elige la carpeta del juego y el
 * navegador (en SU PC, sin subir nada) busca demos y capturas de todos los mods y las cruza con
 * sus partidas. Después sube solo lo que tilde. El servidor vuelve a validar todo (contenido real
 * de la demo, mapa, servidor, jugadores, hora) y rechaza lo que no corresponda.
 */

interface ArchivoPartida { id: string; kind: string; filename: string; pov: string | null; uploadedBy: string | null }
interface PartidaJugador {
  id: string;
  datetime: string;
  map: string;
  type: string;
  duration: number;
  jugadores: string[];
  archivos: ArchivoPartida[];
}

type Estado = "listo" | "subiendo" | "ok" | "error" | "yaEsta";
interface Propuesta {
  clave: string;
  file: File;
  kind: "demo" | "screenshot";
  mod: string;
  partidaId: string | null;
  candidatas: PartidaJugador[];
  marcado: boolean;
  estado: Estado;
  mensaje?: string;
}

const RE_FECHA = /^([A-Z0-9]+)-.*-(\d{4})_(\d{2})_(\d{2})-(\d{2})_(\d{2})_(\d{2})(?:\.[^.]+)?$/i;
const RE_DEMO = /\.dm_\d{2}$/i;
const RE_IMAGEN = /\.(jpe?g|png|tga|bmp)$/i;
const VENTANA_MIN = 10;

const norm = (v: string) => (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function fechaDeNombre(nombre: string): { tipo: string; fecha: Date } | null {
  const m = nombre.match(RE_FECHA);
  if (!m) return null;
  const [, tipo, a, me, d, h, mi, s] = m;
  return { tipo, fecha: new Date(+a, +me - 1, +d, +h, +mi, +s) };
}

function fechaDePartida(datetime: string): Date | null {
  const m = datetime.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

/** diferencia en minutos tolerando husos horarios distintos (horas enteras) */
function distanciaMin(a: Date, b: Date): number {
  const dif = (a.getTime() - b.getTime()) / 60000;
  let mejor = Infinity;
  for (let h = -12; h <= 12; h++) mejor = Math.min(mejor, Math.abs(dif - h * 60));
  return mejor;
}

function tipoCompatible(tipoArchivo: string, tipoPartida: string) {
  const a = norm(tipoArchivo), b = norm(tipoPartida);
  return a === b || b.startsWith(a) || a.startsWith(b);
}

/** cpma / baseq3 / osp / defrag...: la carpeta que contiene a demos/ o screenshots/ */
function modDe(ruta: string): string {
  const partes = ruta.split("/");
  const i = partes.findIndex((p) => /^(demos|screenshots)$/i.test(p));
  return i > 0 ? partes[i - 1] : partes.length > 1 ? partes[partes.length - 2] : "-";
}

function formatear(datetime: string) {
  const d = fechaDePartida(datetime);
  return d ? d.toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : datetime;
}

export default function PlayerAssetsUploader() {
  const queryClient = useQueryClient();
  const carpetaRef = useRef<HTMLInputElement | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(() => {
    try { return window.localStorage.getItem("q3PlayerName") || ""; } catch { return ""; }
  });
  const [partidas, setPartidas] = useState<PartidaJugador[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [escaneo, setEscaneo] = useState<{ total: number; demos: number; capturas: number; sinPartida: number } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const buscarPartidas = async () => {
    setError("");
    setPropuestas([]);
    setEscaneo(null);
    if (nombre.trim().length < 2) { setError("Escribí tu nombre de jugador tal como aparece en el juego."); return; }
    setBuscando(true);
    try {
      const r = await fetch(`/api/player-assets/matches?name=${encodeURIComponent(nombre.trim())}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error buscando partidas");
      setPartidas(data.matches);
      try { window.localStorage.setItem("q3PlayerName", nombre.trim()); } catch { /* sin storage */ }
      if (!data.matches.length) setError(`No encontré partidas de "${nombre.trim()}". Fijate que sea el mismo nombre que usás en el juego.`);
    } catch (e) {
      setError((e as Error).message);
      setPartidas(null);
    } finally {
      setBuscando(false);
    }
  };

  const analizarCarpeta = (lista: FileList | null) => {
    if (!lista || !partidas) return;
    const nuevas: Propuesta[] = [];
    let demos = 0, capturas = 0, sinPartida = 0;
    for (const file of Array.from(lista)) {
      const ruta = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const esDemo = RE_DEMO.test(file.name);
      const fecha = fechaDeNombre(file.name);
      // imágenes: solo las que tienen el nombre automático del juego (no toda la carpeta de fotos)
      const esCaptura = RE_IMAGEN.test(file.name) && !!fecha;
      if (!esDemo && !esCaptura) continue;
      if (esDemo) demos++; else capturas++;
      const nombreNorm = norm(file.name);
      const delMapa = partidas.filter((p) => nombreNorm.includes(norm(p.map)));
      let candidatas: PartidaJugador[] = [];
      if (fecha) {
        candidatas = delMapa
          .filter((p) => tipoCompatible(fecha.tipo, p.type))
          .map((p) => ({ p, d: fechaDePartida(p.datetime) }))
          .filter((x) => x.d && distanciaMin(fecha.fecha, x.d) <= VENTANA_MIN)
          .sort((a, b) => distanciaMin(fecha.fecha, a.d!) - distanciaMin(fecha.fecha, b.d!))
          .map((x) => x.p);
      } else if (esDemo) {
        candidatas = delMapa.slice(0, 30);   // demo sin fecha en el nombre: que elija (el server verifica el contenido)
      }
      const partida = fecha && candidatas.length ? candidatas[0] : null;
      if (!candidatas.length) { sinPartida++; continue; }
      const kind: "demo" | "screenshot" = esDemo ? "demo" : "screenshot";
      const yaEsta = partida?.archivos.some((a) => a.kind === kind && a.filename.toLowerCase() === file.name.toLowerCase());
      nuevas.push({
        clave: ruta,
        file,
        kind,
        mod: modDe(ruta),
        partidaId: partida?.id ?? null,
        candidatas,
        marcado: !!partida && !yaEsta,
        estado: yaEsta ? "yaEsta" : "listo",
        mensaje: yaEsta ? "ya está subida" : undefined,
      });
    }
    nuevas.sort((a, b) => b.file.lastModified - a.file.lastModified);
    setPropuestas(nuevas);
    setEscaneo({ total: lista.length, demos, capturas, sinPartida });
    if (carpetaRef.current) carpetaRef.current.value = "";
  };

  const cambiar = (clave: string, cambio: Partial<Propuesta>) =>
    setPropuestas((ps) => ps.map((p) => (p.clave === clave ? { ...p, ...cambio } : p)));

  const subir = async () => {
    setSubiendo(true);
    for (const p of propuestas.filter((x) => x.marcado && x.partidaId && (x.estado === "listo" || x.estado === "error"))) {
      cambiar(p.clave, { estado: "subiendo", mensaje: undefined });
      try {
        const fd = new FormData();
        fd.append("matchId", p.partidaId!);
        fd.append("kind", p.kind);
        fd.append("playerName", nombre.trim());
        fd.append("file", p.file, p.file.name);
        const r = await fetch("/api/player-assets/upload", { method: "POST", body: fd });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `error ${r.status}`);
        cambiar(p.clave, { estado: "ok", marcado: false, mensaje: data.pov ? `subida · POV de ${data.pov}` : "subida" });
        queryClient.invalidateQueries({ queryKey: [p.kind === "demo" ? "match-demos" : "match-screenshots", p.partidaId] });
      } catch (e) {
        cambiar(p.clave, { estado: "error", mensaje: (e as Error).message });
      }
    }
    setSubiendo(false);
  };

  const marcadas = useMemo(() => propuestas.filter((p) => p.marcado && p.partidaId && p.estado !== "ok").length, [propuestas]);
  const partidaPorId = useMemo(() => new Map((partidas || []).map((p) => [p.id, p])), [partidas]);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" /> Subir mis demos y capturas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir mis demos y capturas</DialogTitle>
          <DialogDescription>
            Asociá tus demos y capturas a tus partidas en 3 pasos. No se sube nada hasta que confirmes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1) nombre */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">1. Tu nombre de jugador</p>
            <div className="flex gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Yim (sin colores)" maxLength={40}
                     onKeyDown={(e) => { if (e.key === "Enter") buscarPartidas(); }} className="max-w-xs" />
              <Button onClick={buscarPartidas} disabled={buscando}>{buscando ? "Buscando..." : "Buscar mis partidas"}</Button>
            </div>
            {partidas && partidas.length > 0 && (
              <p className="text-xs text-muted-foreground">Encontré {partidas.length} partidas tuyas (las más recientes).</p>
            )}
          </div>

          {/* 2) carpeta */}
          {partidas && partidas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">2. Elegí la carpeta de tu Quake 3</p>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                <p className="flex gap-2"><Info className="w-4 h-4 shrink-0 text-primary" />
                  <span>Elegí la carpeta donde está instalado tu Quake 3 (o tu carpeta de perfil). Se buscan solas las
                  <b> demos (.dm_68, .dm_71...)</b> y <b>capturas</b> dentro de <b>todos los mods</b>: baseq3, cpma, osp, defrag, etc.
                  La búsqueda la hace tu navegador en tu PC: <b>no se envía nada</b> hasta que toques "Subir".
                  El navegador puede preguntarte si querés "subir" la carpeta: es solo para leer los nombres, aceptá tranquilo.</span></p>
                <p><b>Windows:</b> la carpeta del juego (ej. <code>C:\Games\Quake3</code>,
                  <code> C:\Program Files (x86)\Quake III Arena</code>, Steam: <code>steamapps\common\Quake 3 Arena</code>)
                  o <code>%APPDATA%\Quake3</code> si usás ioquake3.</p>
                <p><b>Linux:</b> <code>~/.q3a</code> o <code>~/.local/share/Quake3</code> (ioquake3), o la carpeta del juego si usás
                  Quake3e. Son carpetas ocultas: en el selector apretá <b>Ctrl+H</b> para verlas.</p>
                <p><b>Mac:</b> <code>~/Library/Application Support/Quake3</code>.</p>
              </div>
              <input ref={carpetaRef} type="file" className="hidden" multiple
                     // @ts-expect-error: atributos no estándar para elegir carpetas (Chrome, Edge, Firefox, Safari)
                     webkitdirectory="" directory=""
                     onChange={(e) => analizarCarpeta(e.target.files)} />
              <Button variant="secondary" className="gap-2" onClick={() => carpetaRef.current?.click()}>
                <FolderOpen className="w-4 h-4" /> Elegir carpeta del juego
              </Button>
              {escaneo && (
                <p className="text-xs text-muted-foreground">
                  Revisé {escaneo.total} archivos: {escaneo.demos} demos y {escaneo.capturas} capturas.
                  {" "}{propuestas.length} coinciden con tus partidas
                  {escaneo.sinPartida > 0 && `, ${escaneo.sinPartida} no coinciden con ninguna partida tuya`}.
                </p>
              )}
            </div>
          )}

          {/* 3) confirmar */}
          {propuestas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">3. Revisá y subí</p>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left w-8"></th>
                      <th className="p-2 text-left">Archivo</th>
                      <th className="p-2 text-left">Mod</th>
                      <th className="p-2 text-left">Partida</th>
                      <th className="p-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propuestas.map((p) => {
                      const partida = p.partidaId ? partidaPorId.get(p.partidaId) : null;
                      return (
                        <tr key={p.clave} className="border-t">
                          <td className="p-2">
                            <input type="checkbox" checked={p.marcado} disabled={!p.partidaId || p.estado === "ok" || p.estado === "yaEsta" || subiendo}
                                   onChange={(e) => cambiar(p.clave, { marcado: e.target.checked })} />
                          </td>
                          <td className="p-2 max-w-[260px]">
                            <Badge variant="secondary" className="mr-1">{p.kind === "demo" ? "Demo" : "Captura"}</Badge>
                            <span className="break-all">{p.file.name}</span>
                          </td>
                          <td className="p-2">{p.mod}</td>
                          <td className="p-2">
                            {p.candidatas.length > 1 || !partida ? (
                              <select className="bg-background border rounded px-1 py-0.5 max-w-[220px]" value={p.partidaId ?? ""}
                                      disabled={subiendo || p.estado === "ok"}
                                      onChange={(e) => cambiar(p.clave, { partidaId: e.target.value || null, marcado: !!e.target.value })}>
                                <option value="">— elegí la partida —</option>
                                {p.candidatas.map((c) => (
                                  <option key={c.id} value={c.id}>{c.map} · {c.type} · {formatear(c.datetime)}</option>
                                ))}
                              </select>
                            ) : (
                              <span>{partida.map} · {partida.type} · {formatear(partida.datetime)}</span>
                            )}
                          </td>
                          <td className="p-2">
                            {p.estado === "subiendo" ? <span className="text-primary">subiendo…</span>
                              : p.estado === "ok" ? <span className="text-green-500">✓ {p.mensaje}</span>
                              : p.estado === "error" ? <span className="text-destructive">✗ {p.mensaje}</span>
                              : p.estado === "yaEsta" ? <span className="text-muted-foreground">ya está subida</span>
                              : <span className="text-muted-foreground">lista</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={subir} disabled={subiendo || marcadas === 0} className="gap-2">
                  <Upload className="w-4 h-4" /> {subiendo ? "Subiendo..." : `Subir ${marcadas} archivo${marcadas === 1 ? "" : "s"}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Cada archivo se verifica en el servidor: las demos se abren y se controla mapa, servidor y jugadores;
                  las capturas tienen que ser imágenes reales del mapa y la hora de la partida.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
