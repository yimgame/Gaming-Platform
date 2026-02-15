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
  DialogTrigger,
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
import { useEffect, useState } from "react";

interface Screenshot {
  filename: string;
  path: string;
  url: string;
  timestamp?: Date;
  size?: number;
}

interface DemoFile {
  filename: string;
  url: string;
  timestamp?: Date;
  size?: number;
  protocol?: string;
}

async function fetchMatches(): Promise<MatchStats[]> {
  const response = await fetch("/api/stats/matches");
  
  if (!response.ok) {
    throw new Error("Failed to fetch matches");
  }
  
  const data = await response.json();
  return data.matches;
}

function formatDateTime(datetime: string) {
  const date = new Date(datetime.replace(/\//g, '-'));
  return date.toLocaleString('es-ES', {
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
  const [adminToken, setAdminToken] = useState("");

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
    mutationFn: async ({ kind, filename }: { kind: "screenshot" | "demo"; filename: string }) => {
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
        queryClient.invalidateQueries({ queryKey: ["match-screenshots", match.id] });
      } else {
        setManualDemoFilename("");
        queryClient.invalidateQueries({ queryKey: ["match-demos", match.id] });
      }
    },
  });

  const handleManualAssociate = (kind: "screenshot" | "demo") => {
    const filename = (kind === "screenshot" ? manualScreenshotFilename : manualDemoFilename).trim();
    if (!filename) {
      window.alert("Ingresá el nombre del archivo para asociar");
      return;
    }
    associateAssetMutation.mutate({ kind, filename });
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
                      <span className="font-medium text-foreground">Demo</span>
                      <span>{demos[0].protocol ? `Protocolo ${demos[0].protocol}` : "Protocolo N/D"}</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-1/2 mx-auto"
                      onClick={() => window.open(demos[0].url, "_blank")}
                    >
                      Descargar demo
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Demo</span>
                    <span>No asociada</span>
                  </div>
                )}

                {adminEnabled && (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={manualDemoFilename}
                      onChange={(event) => setManualDemoFilename(event.target.value)}
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
                    {screenshots.length > 1 && ` • +${screenshots.length - 1} más`}
                  </div>
                  {adminEnabled && (
                    <div className="p-2 border-t border-border bg-muted/30 space-y-2">
                      <Input
                        value={manualScreenshotFilename}
                        onChange={(event) => setManualScreenshotFilename(event.target.value)}
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
                        <Input
                          value={manualScreenshotFilename}
                          onChange={(event) => setManualScreenshotFilename(event.target.value)}
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

export default function RecentMatches() {
  const [selectedMatch, setSelectedMatch] = useState<MatchStats | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const { data: matches, isLoading, error } = useQuery({
    queryKey: ["matches"],
    queryFn: fetchMatches,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !matches) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Error cargando las partidas</p>
      </Card>
    );
  }

  const sortedMatches = [...matches].sort((a, b) => {
    return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
  });

  const handleMatchClick = (match: MatchStats) => {
    setSelectedMatch(match);
    setShowDetailsDialog(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Calendar className="w-6 h-6 mr-2 text-primary" />
          Partidas Recientes
        </h2>
        <Badge variant="outline" className="text-sm">
          {matches.length} partidas
        </Badge>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="default">Ver todas las partidas</Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Partidas Recientes</DialogTitle>
            <DialogDescription>
              Total de {matches.length} partidas registradas. Haz clic en una para ver detalles.
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Mapa</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Jugadores</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMatches.map((match) => {
                  const totalPlayers = match.teams 
                    ? match.teams.reduce((sum, team) => sum + team.players.length, 0)
                    : match.players?.length || 0;

                  const scoreDisplay = match.teams
                    ? `${match.teams[0]?.score || 0} - ${match.teams[1]?.score || 0}`
                    : `${match.players?.[0]?.score || 0} max`;

                  return (
                    <TableRow 
                      key={`${match.id}-${match.datetime}`}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleMatchClick(match)}
                    >
                      <TableCell className="font-mono text-sm">
                        {formatDateTime(match.datetime)}
                      </TableCell>
                      <TableCell className="font-semibold">{match.map}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{match.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatDuration(match.duration)}
                      </TableCell>
                      <TableCell className="text-center">{totalPlayers}</TableCell>
                      <TableCell className="font-bold">{scoreDisplay}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Últimas partidas
        </p>
        <div className="space-y-2">
          {sortedMatches.slice(0, 5).map((match) => (
            <div
              key={`${match.id}-${match.datetime}`}
              onClick={() => handleMatchClick(match)}
              className="flex items-center justify-between p-3 rounded-lg bg-card border cursor-pointer hover:bg-muted transition-colors"
            >
              <div className="flex-1">
                <p className="font-semibold">{match.map}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(match.datetime)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{match.type}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(match.duration)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MatchDetailsDialog 
        match={selectedMatch}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
    </Card>
  );
}
