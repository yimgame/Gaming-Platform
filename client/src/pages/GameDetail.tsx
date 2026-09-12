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
  Swords,
  Copy,
  Check,
  Download,
  ExternalLink
} from "lucide-react";

// Botón de "copiar comando de conexión" reusable para las tarjetas de server.
// command = lo que se copia al portapapeles (ej. "connect 192.168.0.202:27960").
// label = lo que se muestra en pantalla (puede ser distinto, ej. solo la IP:puerto).
function CopyConnectButton({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error("No se pudo copiar", e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar: ${command}`}
      className="text-sm font-mono text-muted-foreground bg-muted hover:bg-muted/70 px-3 py-1 rounded-md flex items-center gap-2 transition-colors"
    >
      {label}
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
import GlobalRanking from "@/components/GlobalRanking";
import RecentMatches from "@/components/RecentMatches";
import ServerStatsOverview from "@/components/ServerStatsOverview";
import ScreenshotsGallery from "@/components/ScreenshotsGallery";
import type { QuakeServerStatus } from "@shared/stats-schema";
import type { GameConfig } from "@shared/games-config";

interface QuakeServerStatusEntry extends QuakeServerStatus {
  label: string;
  port: number;
  host: string;
}

// Una tarjeta por server (modo + IP:puerto), con su propio levelshot.
// Va aparte del componente principal porque cada una necesita sus propios
// hooks de estado (no se pueden usar hooks dentro de un .map()).
function QuakeServerStatusCard({
  entry,
  fallbackImage,
}: {
  entry: QuakeServerStatusEntry;
  fallbackImage: string;
}) {
  const [showLevelshot, setShowLevelshot] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  const mapName = (entry.mapname || "").trim();
  const levelshotVersion = entry.lastUpdate ? String(entry.lastUpdate) : "";
  const levelshotUrl = mapName
    ? `/api/levelshots/${encodeURIComponent(mapName)}${levelshotVersion ? `?v=${encodeURIComponent(levelshotVersion)}` : ""}`
    : "";
  const displayedImage = showLevelshot && levelshotUrl ? levelshotUrl : fallbackImage;

  useEffect(() => {
    let cancelled = false;
    if (!levelshotUrl) {
      setShowLevelshot(false);
      setImageLoaded(true);
      return () => { cancelled = true; };
    }
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => { if (!cancelled) { setShowLevelshot(true); setImageLoaded(true); } };
    img.onerror = () => { if (!cancelled) { setShowLevelshot(false); setImageLoaded(true); } };
    img.src = levelshotUrl;
    return () => { cancelled = true; };
  }, [levelshotUrl]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" />
          {entry.label}
        </h3>
        <CopyConnectButton
          command={`connect ${entry.host}:${entry.port}`}
          label={`${entry.host}:${entry.port}`}
        />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full lg:w-56 space-y-5">
          <div className="flex items-center space-x-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <p className="text-lg font-bold">Online</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Users className="w-7 h-7 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Jugadores</p>
              <p className="text-lg font-bold">{entry.clients || 0}/{entry.maxClients || 16}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Target className="w-7 h-7 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Mapa actual</p>
              <p className="text-lg font-bold">{entry.mapname || "N/A"}</p>
            </div>
          </div>
        </div>
        <div className="w-full flex-1 flex justify-start lg:justify-center">
          <img
            src={displayedImage}
            alt={showLevelshot ? `Levelshot de ${entry.mapname || "mapa"}` : "Imagen placeholder de mapa"}
            className={`h-[200px] w-full max-w-[420px] rounded-md border border-border object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => { if (showLevelshot) setShowLevelshot(false); else setImageLoaded(true); }}
          />
        </div>
      </div>

      {entry.players && entry.players.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-bold mb-3 flex items-center">
            <Users className="w-4 h-4 mr-2 text-primary" />
            Jugadores conectados ({entry.players.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {entry.players.map((player, index) => (
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
  );
}

interface Cs16ServerStatusEntry {
  online: boolean;
  hostname?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  game?: string;
  label: string;
  port: number;
  host: string;
}

// Tarjeta de server CS 1.6 (GoldSrc). No tiene levelshot todavía, solo datos
// en vivo del protocolo de query (hostname/mapa/jugadores).
function Cs16ServerStatusCard({ entry }: { entry: Cs16ServerStatusEntry }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" />
          {entry.label}
        </h3>
        <CopyConnectButton
          command={`connect ${entry.host}:${entry.port}`}
          label={`${entry.host}:${entry.port}`}
        />
      </div>
      <div className="flex flex-col gap-2 mb-2">
        <p className="text-sm text-muted-foreground">{entry.hostname}</p>
      </div>
      <div className="flex flex-wrap gap-8">
        <div className="flex items-center space-x-4">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="text-lg font-bold">Online</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Users className="w-7 h-7 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Jugadores</p>
            <p className="text-lg font-bold">{entry.players || 0}/{entry.maxPlayers || 16}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Target className="w-7 h-7 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Mapa actual</p>
            <p className="text-lg font-bold">{entry.map || "N/A"}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface MinecraftServerStatusEntry {
  online: boolean;
  motd?: string;
  version?: string;
  players?: number;
  maxPlayers?: number;
  playerSample?: string[];
  label: string;
  port: number;
  host: string;
}

// Tarjeta de server Minecraft (Vanilla/Paper/Forge). Sin levelshot (no aplica
// a Minecraft), muestra motd/versión/jugadores del "Server List Ping".
function MinecraftServerStatusCard({ entry }: { entry: MinecraftServerStatusEntry }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" />
          {entry.label}
        </h3>
        <CopyConnectButton
          command={`${entry.host}:${entry.port}`}
          label={`${entry.host}:${entry.port}`}
        />
      </div>
      {entry.motd && <p className="text-sm text-muted-foreground mb-2">{entry.motd}</p>}
      <div className="flex flex-wrap gap-8">
        <div className="flex items-center space-x-4">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="text-lg font-bold">Online</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Users className="w-7 h-7 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Jugadores</p>
            <p className="text-lg font-bold">{entry.players || 0}/{entry.maxPlayers || 0}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Target className="w-7 h-7 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Versión</p>
            <p className="text-lg font-bold">{entry.version || "N/A"}</p>
          </div>
        </div>
      </div>
      {entry.playerSample && entry.playerSample.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-bold mb-2 flex items-center">
            <Users className="w-4 h-4 mr-2 text-primary" />
            Jugadores conectados
          </h4>
          <div className="flex flex-wrap gap-2">
            {entry.playerSample.map((name, i) => (
              <span key={i} className="text-sm bg-muted px-3 py-1 rounded-md">{name}</span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function GameDetailPage() {
  const [, params] = useRoute("/games/:gameId");
  const gameId = params?.gameId || "";

  const { data: gamesData, isLoading: isGamesLoading, error: gamesError } = useQuery<{ games: GameConfig[] }>({
    queryKey: ["games-catalog"],
    queryFn: async () => {
      const response = await fetch("/api/games");
      if (!response.ok) {
        throw new Error("No se pudo leer el catálogo de juegos");
      }

      const payload = await response.json();
      if (!payload?.games || !Array.isArray(payload.games)) {
        throw new Error("Formato inválido de catálogo de juegos");
      }

      return payload;
    },
  });

  const game = gamesData?.games?.find((item) => item.id === gameId);
  const supportsQuakeStats = Boolean(game?.supportsQuakeStats);
  const supportsCs16Status = Boolean(game?.supportsCs16Status);
  const supportsMinecraftStatus = Boolean(game?.supportsMinecraftStatus);
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

  // Lista de TODOS los servers de Quake3 activos ahora mismo (los 6 fijos +
  // los que haya lanzado el launcher bajo demanda), uno por tarjeta.
  const { data: allServerStatuses } = useQuery<QuakeServerStatusEntry[]>({
    queryKey: ["quake-server-status-all"],
    queryFn: async () => {
      const response = await fetch("/api/server/status/all");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: supportsQuakeStats,
    refetchInterval: 15000,
  });

  // Lista de servers de Counter-Strike 1.6 activos (Bomb/Hostage/Fun)
  const { data: cs16Statuses } = useQuery<Cs16ServerStatusEntry[]>({
    queryKey: ["cs16-server-status-all"],
    queryFn: async () => {
      const response = await fetch("/api/cs16/status/all");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: supportsCs16Status,
    refetchInterval: 15000,
  });

  // Lista de servers de Minecraft activos (Vanilla/Paper/Forge)
  const { data: minecraftStatuses } = useQuery<MinecraftServerStatusEntry[]>({
    queryKey: ["minecraft-server-status-all"],
    queryFn: async () => {
      const response = await fetch("/api/minecraft/status/all");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: supportsMinecraftStatus,
    refetchInterval: 15000,
  });

  // Usar datos del servidor si está disponible (solo para Quake 3)
  const status = supportsQuakeStats && serverStatus 
    ? (serverStatus.online ? "online" : "offline")
    : game?.status || "offline";
  
  const playerCount = supportsQuakeStats && serverStatus?.online
    ? `${serverStatus.clients || 0}/${serverStatus.maxClients || 16}`
    : game?.playerCount || "0/16";

  const currentMapName = supportsQuakeStats && serverStatus?.online
    ? (serverStatus.mapname || "").trim()
    : "";
  const levelshotVersion = serverStatus?.lastUpdate ? String(serverStatus.lastUpdate) : "";
  const levelshotUrl = currentMapName
    ? `/api/levelshots/${encodeURIComponent(currentMapName)}${levelshotVersion ? `?v=${encodeURIComponent(levelshotVersion)}` : ""}`
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

  if (isGamesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando juego...</p>
      </div>
    );
  }

  if (gamesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">No se pudo cargar el juego</h1>
          <p className="text-muted-foreground mb-6">Revisá que el backend esté corriendo y que /api/games responda correctamente.</p>
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

            {/* Descargas: juego base, motor recomendado, mods -- todo lo
                necesario para poder conectarse a nuestros servers. */}
            {game.downloads && game.downloads.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <Download className="w-5 h-5 mr-2 text-primary" />
                  Descargas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {game.downloads.map((dl, index) => (
                    <a
                      key={index}
                      href={dl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col justify-between p-4 rounded-lg border border-primary/20 bg-card/50 hover:border-primary/60 hover:bg-card transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{dl.label}</span>
                          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                        {dl.description && (
                          <p className="text-sm text-muted-foreground">{dl.description}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Servers activos: una tarjeta por cada modo/instancia corriendo ahora */}
            {supportsQuakeStats ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">
                  Servers activos {allServerStatuses ? `(${allServerStatuses.length})` : ""}
                </h2>
                {allServerStatuses && allServerStatuses.length > 0 ? (
                  allServerStatuses.map((entry) => (
                    <QuakeServerStatusCard
                      key={`${entry.host}:${entry.port}`}
                      entry={entry}
                      fallbackImage={placeholderMapImage}
                    />
                  ))
                ) : (
                  <Card className="p-6">
                    <p className="text-muted-foreground">No hay servers activos en este momento.</p>
                  </Card>
                )}
              </div>
            ) : supportsCs16Status ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">
                  Servers activos {cs16Statuses ? `(${cs16Statuses.length})` : ""}
                </h2>
                {cs16Statuses && cs16Statuses.length > 0 ? (
                  cs16Statuses.map((entry) => (
                    <Cs16ServerStatusCard key={`${entry.host}:${entry.port}`} entry={entry} />
                  ))
                ) : (
                  <Card className="p-6">
                    <p className="text-muted-foreground">No hay servers activos en este momento.</p>
                  </Card>
                )}
              </div>
            ) : supportsMinecraftStatus ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">
                  Servers activos {minecraftStatuses ? `(${minecraftStatuses.length})` : ""}
                </h2>
                {minecraftStatuses && minecraftStatuses.length > 0 ? (
                  minecraftStatuses.map((entry) => (
                    <MinecraftServerStatusCard key={`${entry.host}:${entry.port}`} entry={entry} />
                  ))
                ) : (
                  <Card className="p-6">
                    <p className="text-muted-foreground">No hay servers activos en este momento.</p>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Estado del servidor</h2>
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                  <div>
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <p className="text-lg font-bold capitalize">{status}</p>
                  </div>
                </div>
              </Card>
            )}
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



