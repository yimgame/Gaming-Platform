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

interface GameInfo {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  image: string;
  connectUrl?: string;
  status: "online" | "offline" | "maintenance";
  playerCount: string;
  features: string[];
  videos?: string[];
  screenshots?: string[];
}

const gamesInfo: Record<string, GameInfo> = {
  "quake-3-arena": {
    id: "quake-3-arena",
    title: "Quake 3 Arena",
    description: "El rey de los arena shooters. Rocket jumps, strafe jumping y torneos mensuales.",
    longDescription: "Quake III Arena es un shooter multijugador de ritmo rápido que definió el género de los arena shooters. Con su física única, movimiento avanzado y combate frenético, sigue siendo uno de los juegos competitivos más emocionantes.",
    image: "/quake3-hero.jpg",
    connectUrl: "#",
    status: "offline",
    playerCount: "0/16",
    features: [
      "CPMA (Challenge ProMode Arena)",
      "Servidor dedicado 24/7",
      "Estadísticas detalladas",
      "Rankings globales y por partida",
      "Múltiples modos: CTF, TDM, FFA",
      "Mapas clásicos y custom"
    ],
    screenshots: [],
    videos: [],
  },
  "counter-strike-1-6": {
    id: "counter-strike-1-6",
    title: "Counter Strike 1.6",
    description: "El clásico de siempre. Servidor público, mapas custom, baja latencia.",
    longDescription: "Counter-Strike 1.6 es el FPS táctico que definió una generación. Combates intensos 5v5, estrategia de equipo y habilidad individual se combinan en el shooter competitivo más icónico de todos los tiempos.",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "steam://connect/yim.servegame.com:27015",
    status: "online",
    playerCount: "12/32",
    features: [
      "Servidor público dedicado",
      "Mapas clásicos y custom",
      "Baja latencia",
      "Comunidad activa",
      "Mod personalizado",
      "Anti-cheat activo"
    ],
  },
  "counter-strike-2": {
    id: "counter-strike-2",
    title: "Counter Strike 2",
    description: "La nueva generación de CS. Gráficos mejorados, tickrate dinámico.",
    longDescription: "Counter-Strike 2 marca el inicio de una nueva era para el FPS competitivo más grande del mundo. Construido sobre Source 2, ofrece gráficos mejorados, físicas actualizadas y la misma jugabilidad táctica que amas.",
    image: "https://images.unsplash.com/photo-1616514934832-60298a4bb238?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "steam://connect/yim.servegame.com:27016",
    status: "online",
    playerCount: "5/10",
    features: [
      "Gráficos Source 2",
      "Tickrate dinámico",
      "Matchmaking competitivo",
      "Mapas renovados",
      "Sistema de rangos",
      "Sub-tick updates"
    ],
  },
  "minecraft-survival": {
    id: "minecraft-survival",
    title: "Minecraft Survival",
    description: "Mundo survival infinito. Plugins de protección, economía y eventos.",
    longDescription: "Explora un mundo infinito de posibilidades en nuestro servidor Survival. Construye, explora, comercia y sobrevive junto a una comunidad activa. Con plugins de protección y economía para una experiencia equilibrada.",
    image: "https://images.unsplash.com/photo-1607525388365-18ae415b3c54?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "minecraft://connect/yim.servegame.com",
    status: "online",
    playerCount: "25/100",
    features: [
      "Mundo infinito",
      "Protección de terrenos",
      "Economía del servidor",
      "Eventos semanales",
      "Java & Bedrock",
      "Sin lag, alto rendimiento"
    ],
  },
  "quake-2": {
    id: "quake-2",
    title: "Quake 2",
    description: "Acción frenética en la arena. Railgun instagib, CTF y más modos.",
    longDescription: "Quake II revolucionó los shooters multijugador con su combate rápido y mapas icónicos. Experimenta la acción clásica con railgun instagib, CTF y más modos competitivos.",
    image: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "#",
    status: "maintenance",
    playerCount: "0/16",
    features: [
      "Railgun Instagib",
      "Capture The Flag",
      "Mapas clásicos",
      "Física retro auténtica",
      "Duelos 1v1",
      "Competitivo"
    ],
  },
  "quake-1": {
    id: "quake-1",
    title: "Quake 1 (QuakeWorld)",
    description: "Donde todo comenzó. Física pura, bunny hopping y duelos 1v1.",
    longDescription: "El origen de todos los arena shooters. QuakeWorld ofrece la física más pura, bunny hopping perfecto y duelos 1v1 intensos que han resistido la prueba del tiempo.",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "#",
    status: "offline",
    playerCount: "0/16",
    features: [
      "QuakeWorld physics",
      "Bunny hopping",
      "Duelos 1v1 intensos",
      "Movimiento técnico",
      "Arena shooter original",
      "Leyenda viviente"
    ],
  },
};

export default function GameDetailPage() {
  const [, params] = useRoute("/games/:gameId");
  const gameId = params?.gameId || "";
  const game = gamesInfo[gameId];

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
    enabled: gameId === "quake-3-arena",
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Usar datos del servidor si está disponible (solo para Quake 3)
  const status = gameId === "quake-3-arena" && serverStatus 
    ? (serverStatus.online ? "online" : "offline")
    : game?.status || "offline";
  
  const playerCount = gameId === "quake-3-arena" && serverStatus?.online
    ? `${serverStatus.clients || 0}/${serverStatus.maxClients || 16}`
    : game?.playerCount || "0/16";

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
            src={game.image} 
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
                {gameId === "quake-3-arena" && serverStatus?.online && serverStatus.mapname && (
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
            <TabsTrigger value="stats" disabled={gameId !== "quake-3-arena"}>
              <Trophy className="w-4 h-4 mr-2" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="matches" disabled={gameId !== "quake-3-arena"}>
              <Calendar className="w-4 h-4 mr-2" />
              Partidas
            </TabsTrigger>
            <TabsTrigger value="media" disabled={gameId !== "quake-3-arena"}>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      {gameId === "quake-3-arena" && serverStatus?.online ? "Mapa actual" : "Latencia"}
                    </p>
                    <p className="text-lg font-bold">
                      {gameId === "quake-3-arena" && serverStatus?.online 
                        ? serverStatus.mapname || "N/A"
                        : "~15ms"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Lista de jugadores en tiempo real (solo Quake 3) */}
              {gameId === "quake-3-arena" && serverStatus?.online && serverStatus.players && serverStatus.players.length > 0 && (
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
            {gameId === "quake-3-arena" ? (
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
