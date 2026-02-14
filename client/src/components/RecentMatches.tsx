import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";

interface Screenshot {
  filename: string;
  path: string;
  url: string;
  timestamp?: Date;
  size?: number;
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

  // Buscar screenshots por nombre de mapa
  const { data: screenshots, isLoading } = useQuery<Screenshot[]>({
    queryKey: ["map-screenshots", match.map],
    queryFn: async () => {
      console.log('Buscando capturas para mapa:', match.map);
      const response = await fetch(`/api/screenshots/map/${encodeURIComponent(match.map)}`);
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
          {/* Screenshot si existe */}
          {isLoading ? (
            <div className="border rounded-lg overflow-hidden bg-muted h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Buscando capturas...</p>
              </div>
            </div>
          ) : screenshots && screenshots.length > 0 ? (
            <div className="border rounded-lg overflow-hidden bg-black/90">
              <img
                src={screenshots[0].url}
                alt={screenshots[0].filename}
                className="w-full h-80 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(screenshots[0].url, '_blank')}
              />
              <div className="p-2 bg-muted text-xs text-muted-foreground text-center">
                <ImageIcon className="inline w-3 h-3 mr-1" />
                Haz clic para ver en grande
                {screenshots.length > 1 && ` • +${screenshots.length - 1} más`}
              </div>
            </div>
          ) : (
            <div className="border border-dashed rounded-lg bg-muted/30 h-48 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No hay capturas para este mapa</p>
              </div>
            </div>
          )}

          {/* Información básica */}
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
