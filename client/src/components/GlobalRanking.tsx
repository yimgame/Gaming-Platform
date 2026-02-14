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
import { Trophy, Medal, Award, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { PlayerRanking } from "@/../../shared/stats-schema";
import { useState } from "react";

type SortField = 'rank' | 'name' | 'totalScore' | 'totalKills' | 'totalDeaths' | 'kdRatio' | 'totalMatches' | 'avgScore';
type SortDirection = 'asc' | 'desc';

async function fetchGlobalRanking(filters = {}): Promise<PlayerRanking[]> {
  const response = await fetch("/api/stats/ranking/global", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
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
  
  const { data: ranking, isLoading, error } = useQuery({
    queryKey: ["globalRanking"],
    queryFn: () => fetchGlobalRanking(),
  });

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

  const sortedRanking = ranking ? [...ranking].sort((a, b) => {
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
  }) : [];

  if (isLoading) {
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
          {ranking.length} jugadores
        </Badge>
      </div>

      <div className="overflow-x-auto">
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
            {sortedRanking.slice(0, 50).map((player) => (
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
                <TableCell className="font-bold">{player.name}</TableCell>
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
    </Card>
  );
}
