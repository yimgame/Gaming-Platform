import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Trophy, Medal, Award, ArrowUpDown, ArrowUp, ArrowDown, Bot, User } from "lucide-react";
import type { PlayerRanking } from "@/../../shared/stats-schema";
import { useEffect, useState, type ChangeEvent } from "react";

type SortField = 'rank' | 'name' | 'totalScore' | 'totalKills' | 'totalDeaths' | 'kdRatio' | 'totalMatches' | 'avgScore';
type SortDirection = 'asc' | 'desc';

const MODOS = ["1v1", "2v2", "CA", "CTF", "CTFS", "FFA", "FT", "NTF", "TDM"];

type FiltrosRanking = { kind: string; gameType: string; map: string; startDate: string; endDate: string; minMatches: string };
const FILTROS_VACIOS: FiltrosRanking = { kind: "todos", gameType: "", map: "", startDate: "", endDate: "", minMatches: "" };

async function fetchGlobalRanking(f: FiltrosRanking): Promise<PlayerRanking[]> {
  // las fechas van como día de Buenos Aires (AAAA-MM-DD); el server las convierte
  const cuerpo: Record<string, unknown> = { kind: f.kind };
  if (f.gameType) cuerpo.gameType = f.gameType;
  if (f.map.trim()) cuerpo.map = f.map.trim();
  if (f.startDate) cuerpo.startDate = f.startDate;
  if (f.endDate) cuerpo.endDate = f.endDate;
  if (Number(f.minMatches) > 1) cuerpo.minMatches = Number(f.minMatches);
  const response = await fetch("/api/stats/ranking/global", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch ranking");
  }
  
  const data = await response.json();
  return data.ranking;
}

export default function GlobalRanking() {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [borrador, setBorrador] = useState<FiltrosRanking>(FILTROS_VACIOS);   // lo que se tipea
  const [filtros, setFiltros] = useState<FiltrosRanking>(FILTROS_VACIOS);     // lo aplicado
  const [buscar, setBuscar] = useState("");                                   // nombre: se filtra acá, sin ir al server
  const [mostrar, setMostrar] = useState(50);

  // los campos se aplican solos al dejar de tipear (medio segundo)
  useEffect(() => {
    const t = window.setTimeout(() => setFiltros(borrador), 500);
    return () => window.clearTimeout(t);
  }, [borrador]);

  const { data: ranking, isLoading, isFetching, error } = useQuery({
    queryKey: ["globalRanking", filtros],
    queryFn: () => fetchGlobalRanking(filtros),
    placeholderData: (previo) => previo,
  });

  const campo = (k: keyof FiltrosRanking) => ({
    value: borrador[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setBorrador((b) => ({ ...b, [k]: e.target.value })),
  });
  const hayFiltros = buscar.trim() !== "" ||
    (Object.keys(borrador) as (keyof FiltrosRanking)[]).some((k) => borrador[k] !== FILTROS_VACIOS[k]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Por defecto descendente para nueva columna
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 inline opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 inline text-primary" />
      : <ArrowDown className="w-4 h-4 ml-1 inline text-primary" />;
  };

  const limpiarNombre = (n: string) => n.replace(/\^(x[0-9a-fA-F]{6}|.)/g, "").toLowerCase();
  const filtrados = ranking
    ? ranking.filter((p) => !buscar.trim() || limpiarNombre(p.name).includes(buscar.trim().toLowerCase()))
    : [];
  const sortedRanking = [...filtrados].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    
    // Manejar strings (name)
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (isLoading && !ranking) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !ranking) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Error cargando el ranking</p>
      </Card>
    );
  }

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Trophy className="w-6 h-6 mr-2 text-primary" />
          Ranking Global
        </h2>
        <Badge variant="outline" className="text-sm">
          {filtrados.length} jugadores
        </Badge>
      </div>

      {/* filtros */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" title="Humanos o bots" {...campo("kind")}>
          <option value="todos">Humanos y bots</option>
          <option value="humanos">👤 Solo humanos</option>
          <option value="bots">🤖 Solo bots</option>
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" {...campo("gameType")}>
          <option value="">Todos los modos</option>
          {MODOS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <Input placeholder="Jugador" className="h-9" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <Input placeholder="Mapa" className="h-9" {...campo("map")} />
        <Input type="date" className="h-9" title="Desde" {...campo("startDate")} />
        <Input type="date" className="h-9" title="Hasta" {...campo("endDate")} />
        <Input type="number" min={1} placeholder="Mín. partidas" className="h-9" title="Mínimo de partidas" {...campo("minMatches")} />
        <Button variant="ghost" className="h-9" disabled={!hayFiltros}
                onClick={() => { setBorrador(FILTROS_VACIOS); setFiltros(FILTROS_VACIOS); setBuscar(""); }}>
          Limpiar filtros
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        👤 humano · 🤖 bot — se distingue por los registros de los servers (los bots entran con nivel de dificultad).
      </p>

      <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('rank')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Rank{getSortIcon('rank')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('name')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Jugador{getSortIcon('name')}
                </Button>
              </TableHead>
              <TableHead>Modos</TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('totalScore')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Score{getSortIcon('totalScore')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('totalKills')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Kills{getSortIcon('totalKills')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('totalDeaths')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Deaths{getSortIcon('totalDeaths')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('kdRatio')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  K/D{getSortIcon('kdRatio')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('totalMatches')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Partidas{getSortIcon('totalMatches')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('avgScore')}
                  className="h-8 p-0 hover:bg-transparent"
                >
                  Avg Score{getSortIcon('avgScore')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRanking.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No hay jugadores con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {sortedRanking.slice(0, mostrar).map((player) => (
              <TableRow 
                key={player.name}
                className={player.rank <= 3 ? "bg-muted/50" : ""}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {getMedalIcon(player.rank)}
                    <span>#{player.rank}</span>
                  </div>
                </TableCell>
                <TableCell className="font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    {player.kind === "humano" ? (
                      <User className="w-4 h-4 text-green-500 shrink-0" aria-label="humano" />
                    ) : player.kind === "bot" ? (
                      <Bot className="w-4 h-4 text-muted-foreground shrink-0" aria-label="bot" />
                    ) : null}
                    <span title={player.kind === "humano" ? "Humano" : player.kind === "bot" ? "Bot" : "Sin datos"}>
                      {player.name}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {player.gameTypes?.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {player.totalScore.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-green-500">
                  {player.totalKills.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-red-500">
                  {player.totalDeaths.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Badge variant={player.kdRatio >= 1 ? "default" : "secondary"}>
                    {player.kdRatio.toFixed(2)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {player.totalMatches}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {player.avgScore.toFixed(0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sortedRanking.length > 50 && (
        <div className="flex items-center justify-end gap-2 mt-4 text-sm text-muted-foreground">
          Mostrar
          <select className="h-8 rounded-md border bg-background px-2 text-sm" value={mostrar}
                  onChange={(e) => setMostrar(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={100000}>todos</option>
          </select>
          de {sortedRanking.length}
        </div>
      )}
    </Card>
  );
}
