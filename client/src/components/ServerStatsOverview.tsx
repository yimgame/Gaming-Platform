import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Users, 
  Swords, 
  TrendingUp,
  MapPin,
  Gamepad2
} from "lucide-react";

interface ServerStats {
  totalMatches: number;
  totalPlayers: number;
  totalKills: number;
  totalDeaths: number;
  totalDamage: number;
  maps: Array<{ map: string; count: number }>;
  gameTypes: Array<{ type: string; count: number }>;
}

async function fetchServerStats(): Promise<ServerStats> {
  const response = await fetch("/api/stats/server");
  
  if (!response.ok) {
    throw new Error("Failed to fetch server stats");
  }
  
  return response.json();
}

export default function ServerStatsOverview() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["serverStats"],
    queryFn: fetchServerStats,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-8 bg-muted rounded w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Error cargando estadísticas del servidor</p>
      </Card>
    );
  }

  const statCards = [
    {
      title: "Total Partidas",
      value: stats.totalMatches.toLocaleString(),
      icon: Activity,
      color: "text-blue-500",
    },
    {
      title: "Total Jugadores",
      value: stats.totalPlayers.toLocaleString(),
      icon: Users,
      color: "text-green-500",
    },
    {
      title: "Total Kills",
      value: stats.totalKills.toLocaleString(),
      icon: Swords,
      color: "text-red-500",
    },
    {
      title: "Total Daño",
      value: (stats.totalDamage / 1000).toFixed(1) + "K",
      icon: TrendingUp,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <Icon className={`w-12 h-12 ${stat.color}`} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Mapas y Modos más jugados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <MapPin className="w-5 h-5 mr-2 text-primary" />
            <h3 className="text-lg font-bold">Mapas Más Jugados</h3>
          </div>
          <div className="space-y-3">
            {stats.maps.slice(0, 5).map((map, idx) => (
              <div key={map.map} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <span className="text-2xl font-bold text-muted-foreground mr-3 w-6">
                    #{idx + 1}
                  </span>
                  <span className="font-semibold">{map.map}</span>
                </div>
                <Badge variant="secondary">
                  {map.count} partidas
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Gamepad2 className="w-5 h-5 mr-2 text-primary" />
            <h3 className="text-lg font-bold">Modos Más Jugados</h3>
          </div>
          <div className="space-y-3">
            {stats.gameTypes.slice(0, 5).map((type, idx) => (
              <div key={type.type} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <span className="text-2xl font-bold text-muted-foreground mr-3 w-6">
                    #{idx + 1}
                  </span>
                  <span className="font-semibold">{type.type}</span>
                </div>
                <Badge variant="secondary">
                  {type.count} partidas
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Estadísticas adicionales */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Datos Interesantes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">K/D Ratio Promedio</p>
            <p className="text-2xl font-bold">
              {(stats.totalKills / stats.totalDeaths).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Kills por Partida</p>
            <p className="text-2xl font-bold">
              {(stats.totalKills / stats.totalMatches).toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Daño por Partida</p>
            <p className="text-2xl font-bold">
              {(stats.totalDamage / stats.totalMatches).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
