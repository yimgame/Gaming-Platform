import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Users, 
  Trophy, 
  Activity, 
  TrendingUp, 
  Calendar,
  Target,
  Shield,
  Swords
} from "lucide-react";
import GlobalRanking from "@/components/GlobalRanking";
import RecentMatches from "@/components/RecentMatches";
import ServerStatsOverview from "@/components/ServerStatsOverview";
import ScreenshotsGallery from "@/components/ScreenshotsGallery";
import type { QuakeServerStatus } from "@shared/stats-schema";
import type { GameConfig } from "@shared/games-config";
import { defaultGamesCatalog } from "@/lib/defaultGames";

export default function GameDetailPage() {
  const [, params] = useRoute("/games/:gameId");
  const gameId = params?.gameId || "";

  const { data: gamesData } = useQuery<{ games: GameConfig[] }>({
    queryKey: ["games-catalog"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/games");
        if (!response.ok) {
          return { games: defaultGamesCatalog };
        }

        const payload = await response.json();
        if (!payload?.games || !Array.isArray(payload.games) || payload.games.length === 0) {
          return { games: defaultGamesCatalog };
        }

        return payload;
      } catch {
        return { games: defaultGamesCatalog };
      }
    },
  });

  const game = gamesData?.games?.find((item) => item.id === gameId);
  const supportsQuakeStats = Boolean(game?.supportsQuakeStats);
  const [showLevelshot, setShowLevelshot] = useState(true);
  const [mapImageLoaded, setMapImageLoaded] = useState(false);

  // Consultar estado del servidor para Quake 3
  const { data: serverStatus } = useQuery<QuakeServerStatus>({
    queryKey: ["quake-server-status"],
    queryFn: async () => {
      const response = await fetch("/api/server/status");
      if (!response.ok) {
        return { online: false };
      }
      return response.json();
    },
    enabled: supportsQuakeStats,
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Usar datos del servidor si está disponible (solo para Quake 3)
  const status = supportsQuakeStats && serverStatus 
    ? (serverStatus.online ? "online" : "offline")
    : game?.status || "offline";
  
  const playerCount = supportsQuakeStats && serverStatus?.online
    ? `${serverStatus.clients || 0}/${serverStatus.maxClients || 16}`
    : game?.playerCount || "0/16";

  const currentMapName = supportsQuakeStats && serverStatus?.online
    ? serverStatus.mapname || ""
    : "";
  const levelshotUrl = currentMapName
    ? `/api/levelshots/${encodeURIComponent(currentMapName)}`
    : "";
  const placeholderMapImage = game?.cardImage || game?.backgroundImage || "/quake3-hero.jpg";
  const displayedMapImage = showLevelshot && levelshotUrl ? levelshotUrl : placeholderMapImage;

  useEffect(() => {
    let cancelled = false;

    if (!levelshotUrl) {
      setShowLevelshot(false);
      setMapImageLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    setMapImageLoaded(false);

    const prefetchImage = new Image();
    prefetchImage.onload = () => {
      if (cancelled) return;
      setShowLevelshot(true);
      setMapImageLoaded(true);
    };
    prefetchImage.onerror = () => {
      if (cancelled) return;
      setShowLevelshot(false);
      setMapImageLoaded(true);
    };
    prefetchImage.src = levelshotUrl;

    return () => {
      cancelled = true;
    };
  }, [levelshotUrl]);

  useEffect(() => {
    if (showLevelshot) return;
    setMapImageLoaded(false);
  }, [showLevelshot, placeholderMapImage]);

  if (!gamesData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando juego...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Juego no encontrado</h1>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative h-96 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={game.backgroundImage} 
            alt={game.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-12">
          <Link href="/#games">
            <Button variant="outline" className="mb-8 w-fit">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a servidores
            </Button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                {game.title}
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mb-4">
                {game.description}
              </p>
              <div className="flex items-center gap-4">
                <Badge variant={status === "online" ? "default" : "destructive"} 
                       className={status === "online" ? "bg-green-500" : "bg-red-500"}>
                  {status.toUpperCase()}
                </Badge>
                <div className="flex items-center text-muted-foreground">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{playerCount} Players</span>
                </div>
                {supportsQuakeStats && serverStatus?.online && serverStatus.mapname && (
                  <div className="flex items-center text-muted-foreground">
                    <Target className="w-4 h-4 mr-2" />
                    <span>{serverStatus.mapname}</span>
                  </div>
                )}
              </div>
            </div>
            
            {game.connectUrl && (
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <a href={game.connectUrl}>
                  ¡Jugar Ahora!
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">
              <Activity className="w-4 h-4 mr-2" />
              Información
            </TabsTrigger>
            <TabsTrigger value="stats" disabled={!supportsQuakeStats}>
              <Trophy className="w-4 h-4 mr-2" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="matches" disabled={!supportsQuakeStats}>
              <Calendar className="w-4 h-4 mr-2" />
              Partidas
            </TabsTrigger>
            <TabsTrigger value="media" disabled={!supportsQuakeStats}>
              <Target className="w-4 h-4 mr-2" />
              Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Acerca del servidor</h2>
              <p className="text-muted-foreground text-lg mb-6">{game.longDescription}</p>
              
              <h3 className="text-xl font-bold mb-4">Características</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {game.features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <Shield className="w-5 h-5 mr-3 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Server Status Card */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Estado del servidor</h2>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="w-full lg:w-64 space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                    <div>
                      <p className="text-sm text-muted-foreground">Estado</p>
                      <p className="text-lg font-bold capitalize">{status}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Users className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Jugadores</p>
                      <p className="text-lg font-bold">{playerCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Target className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {supportsQuakeStats && serverStatus?.online ? "Mapa actual" : "Latencia"}
                      </p>
                      <p className="text-lg font-bold">
                        {supportsQuakeStats && serverStatus?.online
                          ? serverStatus.mapname || "N/A"
                          : "~15ms"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full flex-1 flex justify-start lg:justify-center">
                  {(supportsQuakeStats && serverStatus?.online) && (
                    <img
                      src={displayedMapImage}
                      alt={showLevelshot ? `Levelshot de ${serverStatus.mapname || "mapa"}` : "Imagen placeholder de mapa"}
                      className={`h-[280px] w-full max-w-[520px] rounded-md border border-border object-cover transition-opacity duration-500 ${mapImageLoaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setMapImageLoaded(true)}
                      onError={() => {
                        if (showLevelshot) {
                          setShowLevelshot(false);
                          return;
                        }
                        setMapImageLoaded(true);
                      }}
                    />
                  )}
                </div>
              </div>
              
              {/* Lista de jugadores en tiempo real (solo Quake 3) */}
              {supportsQuakeStats && serverStatus?.online && serverStatus.players && serverStatus.players.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-primary" />
                    Jugadores conectados ({serverStatus.players.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {serverStatus.players.map((player, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="font-semibold">{player.name}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span className="font-mono">{player.score} pts</span>
                          <span className="font-mono">{player.ping}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="space-y-6">
              <ServerStatsOverview />
              <GlobalRanking />
            </div>
          </TabsContent>

          <TabsContent value="matches">
            <RecentMatches />
          </TabsContent>

          <TabsContent value="media">
            {supportsQuakeStats ? (
              <ScreenshotsGallery />
            ) : (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Imágenes y Videos</h2>
                <p className="text-muted-foreground">
                  Los medios se cargarán aquí próximamente...
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
