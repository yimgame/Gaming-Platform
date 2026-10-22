import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Image as ImageIcon } from "lucide-react";
import type { MatchStats } from "@shared/stats-schema";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import PlayerAssetsUploader from "@/components/PlayerAssetsUploader";

interface SubidaInfo {
  assetId?: string;
  pov?: string | null;
  uploadedBy?: string | null;
  origin?: string | null;
}

interface Screenshot extends SubidaInfo {
  filename: string;
  path: string;
  url: string;
  timestamp?: Date;
  size?: number;
}

interface DemoFile extends SubidaInfo {
  filename: string;
  url: string;
  timestamp?: Date;
  size?: number;
  protocol?: string;
}

interface FiltrosPartidas {
  type: string;
  map: string;
  player: string;
  from: string;
  to: string;
}

interface PaginaPartidas {
  matches: MatchStats[];
  total: number;
  page: number;
  pageSize: number;
}

const MODOS = ["1v1", "2v2", "CA", "CTF", "CTFS", "FFA", "FT", "NTF", "TDM"];

async function fetchMatchesPage(page: number, pageSize: number, f: FiltrosPartidas): Promise<PaginaPartidas> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [k, v] of Object.entries(f)) if (v.trim()) params.set(k, v.trim());
  const response = await fetch(`/api/stats/matches?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch matches");
  }
  return response.json();
}

function etiquetaSubida(item: SubidaInfo) {
  if (item.origin === "jugador") {
    return item.pov ? `POV de ${item.pov} · subida por ${item.uploadedBy}` : `subida por ${item.uploadedBy}`;
  }
  return item.pov ? `POV de ${item.pov}` : null;
}

function formatDateTime(datetime: string) {
  // el server ya la manda en hora de Buenos Aires ("AAAA/MM/DD HH:MM:SS"); se muestra tal cual
  const m = datetime.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  const date = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : new Date(datetime.replace(/\//g, '-'));
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function MatchDetailsDialog({ match, open, onOpenChange }: { match: MatchStats | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!match) return null;

  const queryClient = useQueryClient();
  const [manualScreenshotFilename, setManualScreenshotFilename] = useState("");
  const [manualDemoFilename, setManualDemoFilename] = useState("");
  const [manualScreenshotFile, setManualScreenshotFile] = useState<File | null>(null);
  const [manualDemoFile, setManualDemoFile] = useState<File | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const screenshotFileInputRef = useRef<HTMLInputElement | null>(null);
  const demoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const stored = window.localStorage.getItem("adminToken") || "";
    setAdminToken(stored);
  }, [open]);

  const adminStatusQuery = useQuery<{ enabled: boolean }>({
    queryKey: ["admin-status", adminToken],
    queryFn: async () => {
      const response = await fetch("/api/admin/status", {
        headers: {
          "x-admin-token": adminToken,
        },
      });

      if (!response.ok) {
        return { enabled: false };
      }

      return response.json();
    },
    enabled: open && adminToken.trim().length > 0,
  });

  const adminEnabled = Boolean(adminStatusQuery.data?.enabled);

  const associateAssetMutation = useMutation({
    mutationFn: async ({ kind, filename, file }: { kind: "screenshot" | "demo"; filename: string; file?: File | null }) => {
      if (file) {
        const formData = new FormData();
        formData.append("matchId", match.id);
        formData.append("kind", kind);
        formData.append("file", file);

        const uploadResponse = await fetch("/api/match-assets/upload", {
          method: "POST",
          headers: {
            "x-admin-token": adminToken,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("No se pudo subir el archivo");
        }

        return uploadResponse.json();
      }

      const response = await fetch("/api/match-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: match.id,
          kind,
          filename,
          adminToken,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo asociar el archivo");
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      if (variables.kind === "screenshot") {
        setManualScreenshotFilename("");
        setManualScreenshotFile(null);
        if (screenshotFileInputRef.current) {
          screenshotFileInputRef.current.value = "";
        }
        queryClient.invalidateQueries({ queryKey: ["match-screenshots", match.id] });
      } else {
        setManualDemoFilename("");
        setManualDemoFile(null);
        if (demoFileInputRef.current) {
          demoFileInputRef.current.value = "";
        }
        queryClient.invalidateQueries({ queryKey: ["match-demos", match.id] });
      }
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async ({ assetId }: { assetId: string; kind: "screenshot" | "demo" }) => {
      const response = await fetch(`/api/match-assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      });
      if (!response.ok) throw new Error("No se pudo borrar");
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.kind === "demo" ? "match-demos" : "match-screenshots", match.id] });
    },
  });

  const borrarSubida = (kind: "screenshot" | "demo", item: SubidaInfo & { filename: string }) => {
    if (!item.assetId) return;
    if (!window.confirm(`¿Borrar ${item.filename}${item.uploadedBy ? ` (subida por ${item.uploadedBy})` : ""}?`)) return;
    deleteAssetMutation.mutate({ assetId: item.assetId, kind });
  };

  const handleManualAssociate = (kind: "screenshot" | "demo") => {
    const filename = (kind === "screenshot" ? manualScreenshotFilename : manualDemoFilename).trim();
    const file = kind === "screenshot" ? manualScreenshotFile : manualDemoFile;

    if (!filename) {
      window.alert("Ingresá el nombre del archivo para asociar");
      return;
    }

    associateAssetMutation.mutate({ kind, filename, file });
  };

  const handleLocalFilePick = (kind: "screenshot" | "demo", file: File | null) => {
    if (!file) return;
    if (kind === "screenshot") {
      setManualScreenshotFile(file);
      setManualScreenshotFilename(file.name);
      return;
    }
    setManualDemoFile(file);
    setManualDemoFilename(file.name);
  };

  // Buscar screenshots por partida
  const { data: screenshots, isLoading } = useQuery<Screenshot[]>({
    queryKey: ["match-screenshots", match.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: match.type,
        map: match.map,
        datetime: match.datetime,
        matchId: match.id,
      });
      console.log('Buscando capturas para partida:', match.id);
      const response = await fetch(`/api/screenshots/match?${params.toString()}`);
      if (!response.ok) {
        console.log('Error en respuesta:', response.status);
        return [];
      }
      const data = await response.json();
      console.log('Capturas recibidas:', data.screenshots?.length || 0);
      return data.screenshots || [];
    },
    enabled: open, // Solo buscar cuando el dialog está abierto
  });

  const { data: demos, isLoading: isDemosLoading } = useQuery<DemoFile[]>({
    queryKey: ["match-demos", match.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: match.type,
        map: match.map,
        datetime: match.datetime,
        matchId: match.id,
      });
      const response = await fetch(`/api/demos/match?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.demos || [];
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de la Partida</DialogTitle>
          <DialogDescription>
            {match.map} - {match.type}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            <div className="space-y-4 lg:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mapa</p>
                  <p className="font-bold text-lg">{match.map}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-bold text-lg">{match.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-bold text-lg">{formatDateTime(match.datetime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duración</p>
                  <p className="font-bold text-lg">{formatDuration(match.duration)}</p>
                </div>
              </div>

              <div className="border rounded-lg p-3 bg-muted/30 lg:max-w-[260px]">
                {isDemosLoading ? (
                  <p className="text-sm">Buscando demo...</p>
                ) : demos && demos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{demos.length > 1 ? `Demos (${demos.length})` : "Demo"}</span>
                      <span>{demos[0].protocol ? `Protocolo ${demos[0].protocol}` : ""}</span>
                    </div>
                    {demos.map((demo) => (
                      <div key={demo.url} className="rounded border border-border/60 p-2 space-y-1">
                        <p className="text-xs font-medium">{etiquetaSubida(demo) ?? demo.filename}</p>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => window.open(demo.url, "_blank")}>
                            Descargar
                          </Button>
                          {adminEnabled && demo.assetId && (
                            <Button size="sm" variant="destructive" onClick={() => borrarSubida("demo", demo)}
                                    disabled={deleteAssetMutation.isPending}>
                              Borrar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Demo</span>
                    <span>No asociada</span>
                  </div>
                )}

                {adminEnabled && (
                  <div className="mt-3 space-y-2">
                    <input
                      ref={demoFileInputRef}
                      type="file"
                      className="hidden"
                      accept=".dm_67,.dm_68,.dm_69,.dm_70,.dm_71,.dm_72,.dm_73,.dm_74,.dm_75,.dm_76,.dm_77,.dm_78,.dm_79,.dm_80,.dm_81,.dm_82,.dm_83,.dm_84,.dm_85,.dm_86,.dm_87,.dm_88,.dm_89,.dm_90"
                      onChange={(event) => handleLocalFilePick("demo", event.target.files?.[0] ?? null)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => demoFileInputRef.current?.click()}
                    >
                      Buscar demo en la PC
                    </Button>
                    <Input
                      value={manualDemoFilename}
                      onChange={(event) => {
                        setManualDemoFile(null);
                        setManualDemoFilename(event.target.value);
                      }}
                      placeholder="Archivo demo (.dm_68)"
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={associateAssetMutation.isPending}
                      onClick={() => handleManualAssociate("demo")}
                    >
                      Asociar demo manual
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 flex items-start justify-center lg:-mt-8">
              {isLoading ? (
                <div className="border rounded-lg overflow-hidden bg-muted h-64 lg:h-full min-h-[240px] w-full max-w-[640px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Buscando capturas...</p>
                  </div>
                </div>
              ) : screenshots && screenshots.length > 0 ? (
                <div className="border rounded-lg overflow-hidden bg-black/90 h-full min-h-[240px] w-full max-w-[640px]">
                  <img
                    src={screenshots[0].url}
                    alt={screenshots[0].filename}
                    className="w-full h-full min-h-[240px] max-h-[340px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(screenshots[0].url, '_blank')}
                  />
                  <div className="p-2 bg-muted text-xs text-muted-foreground text-center">
                    <ImageIcon className="inline w-3 h-3 mr-1" />
                    Haz clic para ver en grande
                    {etiquetaSubida(screenshots[0]) && ` • ${etiquetaSubida(screenshots[0])}`}
                    {adminEnabled && screenshots[0].assetId && (
                      <button className="ml-2 text-destructive underline" onClick={() => borrarSubida("screenshot", screenshots[0])}>
                        borrar
                      </button>
                    )}
                  </div>
                  {screenshots.length > 1 && (
                    <div className="flex gap-2 p-2 overflow-x-auto bg-muted/60">
                      {screenshots.slice(1).map((shot) => (
                        <div key={shot.url} className="shrink-0 text-center">
                          <img src={shot.url} alt={shot.filename} title={etiquetaSubida(shot) ?? shot.filename}
                               className="h-16 rounded cursor-pointer hover:opacity-80" onClick={() => window.open(shot.url, "_blank")} />
                          {adminEnabled && shot.assetId && (
                            <button className="text-[10px] text-destructive underline" onClick={() => borrarSubida("screenshot", shot)}>
                              borrar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {adminEnabled && (
                    <div className="p-2 border-t border-border bg-muted/30 space-y-2">
                      <input
                        ref={screenshotFileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,.tga"
                        onChange={(event) => handleLocalFilePick("screenshot", event.target.files?.[0] ?? null)}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => screenshotFileInputRef.current?.click()}
                      >
                        Buscar captura en la PC
                      </Button>
                      <Input
                        value={manualScreenshotFilename}
                        onChange={(event) => {
                          setManualScreenshotFile(null);
                          setManualScreenshotFilename(event.target.value);
                        }}
                        placeholder="Archivo screenshot (.jpg/.png)"
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={associateAssetMutation.isPending}
                        onClick={() => handleManualAssociate("screenshot")}
                      >
                        Asociar captura manual
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed rounded-lg bg-muted/30 h-64 lg:h-full min-h-[240px] w-full max-w-[640px] flex items-center justify-center">
                  <div className="text-center p-3 w-full max-w-sm space-y-3">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No hay capturas para este mapa</p>
                    {adminEnabled && (
                      <>
                        <input
                          ref={screenshotFileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*,.tga"
                          onChange={(event) => handleLocalFilePick("screenshot", event.target.files?.[0] ?? null)}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => screenshotFileInputRef.current?.click()}
                        >
                          Buscar captura en la PC
                        </Button>
                        <Input
                          value={manualScreenshotFilename}
                          onChange={(event) => {
                            setManualScreenshotFile(null);
                            setManualScreenshotFilename(event.target.value);
                          }}
                          placeholder="Archivo screenshot (.jpg/.png)"
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={associateAssetMutation.isPending}
                          onClick={() => handleManualAssociate("screenshot")}
                        >
                          Asociar captura manual
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Equipos o Jugadores */}
          {match.isTeamGame && match.teams && match.teams.length > 0 ? (
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-bold text-lg">Equipos</h3>
              <div className="grid grid-cols-2 gap-6">
                {match.teams.map((team, teamIdx) => (
                  <div key={teamIdx} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base">{team.name}</h4>
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {team.score}
                      </Badge>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {team.players.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.kills}K/{player.deaths}D • {player.damageGiven} dmg
                            </p>
                          </div>
                          <p className="font-bold ml-2">{player.score}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-bold text-lg">Jugadores</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {match.players?.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex-1">
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {player.kills}K/{player.deaths}D • Daño: {player.damageGiven}
                      </p>
                    </div>
                    <p className="font-bold">{player.score}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FILTROS_VACIOS: FiltrosPartidas = { type: "", map: "", player: "", from: "", to: "" };

export default function RecentMatches() {
  const [selectedMatch, setSelectedMatch] = useState<MatchStats | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [borrador, setBorrador] = useState<FiltrosPartidas>(FILTROS_VACIOS);   // lo que se tipea
  const [filtros, setFiltros] = useState<FiltrosPartidas>(FILTROS_VACIOS);     // lo aplicado

  // los campos de texto se aplican solos al dejar de tipear (medio segundo)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFiltros((actual) => {
        const iguales = (Object.keys(borrador) as (keyof FiltrosPartidas)[]).every((k) => borrador[k] === actual[k]);
        if (iguales) return actual;
        setPage(1);
        return borrador;
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [borrador]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["matches", page, pageSize, filtros],
    queryFn: () => fetchMatchesPage(page, pageSize, filtros),
    placeholderData: (previo) => previo,
  });

  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  const matches = data?.matches ?? [];
  const hayFiltros = Object.values(filtros).some((v) => v.trim());

  const handleMatchClick = (match: MatchStats) => {
    setSelectedMatch(match);
    setShowDetailsDialog(true);
  };

  const campo = (k: keyof FiltrosPartidas) => ({
    value: borrador[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setBorrador((b) => ({ ...b, [k]: e.target.value })),
  });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Calendar className="w-6 h-6 mr-2 text-primary" />
          Partidas
        </h2>
        <div className="flex items-center gap-2">
          <PlayerAssetsUploader />
          <Badge variant="outline" className="text-sm">
            {total.toLocaleString("es-AR")} {hayFiltros ? "encontradas" : "en total"}
          </Badge>
        </div>
      </div>

      {/* filtros */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" {...campo("type")}>
          <option value="">Todos los modos</option>
          {MODOS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <Input placeholder="Mapa" className="h-9" {...campo("map")} />
        <Input placeholder="Jugador" className="h-9" {...campo("player")} />
        <Input type="date" className="h-9" title="Desde" {...campo("from")} />
        <Input type="date" className="h-9" title="Hasta" {...campo("to")} />
        <Button variant="ghost" className="h-9" disabled={!Object.values(borrador).some((v) => v)}
                onClick={() => { setBorrador(FILTROS_VACIOS); setFiltros(FILTROS_VACIOS); setPage(1); }}>
          Limpiar filtros
        </Button>
      </div>

      {error ? (
        <p className="text-destructive">Error cargando las partidas</p>
      ) : isLoading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
        </div>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Mapa</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead className="text-center">Jugadores</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay partidas con esos filtros.
                  </TableCell>
                </TableRow>
              ) : matches.map((match) => {
                const totalPlayers = match.teams
                  ? match.teams.reduce((sum, team) => sum + team.players.length, 0)
                  : match.players?.length || 0;
                const scoreDisplay = match.teams
                  ? `${match.teams[0]?.score || 0} - ${match.teams[1]?.score || 0}`
                  : `${match.players?.[0]?.score || 0} max`;
                return (
                  <TableRow key={`${match.id}-${match.datetime}`} className="cursor-pointer hover:bg-muted"
                            onClick={() => handleMatchClick(match)}>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{formatDateTime(match.datetime)}</TableCell>
                    <TableCell className="font-semibold">{match.map}</TableCell>
                    <TableCell><Badge variant="secondary">{match.type}</Badge></TableCell>
                    <TableCell className="font-mono">{formatDuration(match.duration)}</TableCell>
                    <TableCell className="text-center">{totalPlayers}</TableCell>
                    <TableCell className="font-bold">{scoreDisplay}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* paginación */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Mostrar</span>
          {[10, 50, 100].map((n) => (
            <Button key={n} size="sm" variant={pageSize === n ? "default" : "outline"}
                    onClick={() => { setPageSize(n); setPage(1); }}>{n}</Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage(1)}>«</Button>
          <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-muted-foreground whitespace-nowrap">
            Página {page.toLocaleString("es-AR")} de {paginas.toLocaleString("es-AR")}
          </span>
          <Button size="sm" variant="outline" disabled={page >= paginas || isFetching} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          <Button size="sm" variant="outline" disabled={page >= paginas || isFetching} onClick={() => setPage(paginas)}>»</Button>
        </div>
      </div>

      {selectedMatch && (
        <MatchDetailsDialog
          key={selectedMatch.id}
          match={selectedMatch}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </Card>
  );
}
