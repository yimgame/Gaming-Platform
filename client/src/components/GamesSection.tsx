import GameCard from "./GameCard";
import { useQuery } from "@tanstack/react-query";
import type { QuakeServerStatus } from "@shared/stats-schema";
import type { GameConfig } from "@shared/games-config";
import { defaultGamesCatalog } from "@/lib/defaultGames";

export default function GamesSection() {
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

  // Consultar estado del servidor Quake 3 en tiempo real
  const { data: q3aStatus } = useQuery<QuakeServerStatus>({
    queryKey: ["quake-server-status"],
    queryFn: async () => {
      const response = await fetch("/api/server/status");
      if (!response.ok) {
        return { online: false };
      }
      return response.json();
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  const games = gamesData?.games || [];

  // Actualizar datos de Quake 3 con el estado real del servidor
  const gamesWithLiveData = games.map(game => {
    if (game.supportsQuakeStats && q3aStatus) {
      return {
        ...game,
        status: q3aStatus.online ? "online" as const : "offline" as const,
        playerCount: q3aStatus.online 
          ? `${q3aStatus.clients || 0}/${q3aStatus.maxClients || 16}`
          : "0/16"
      };
    }
    return game;
  });

  return (
    <section id="games" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-background/50">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(0 240 255) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(0 240 255) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Nuestros <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Servidores</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Únete a la acción en nuestros servidores dedicados de baja latencia.
            Disponibles 24/7 para la mejor experiencia de juego.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {gamesWithLiveData.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              title={game.title}
              description={game.description}
              tags={game.tags}
              image={game.cardImage}
              connectUrl={game.connectUrl}
              status={game.status}
              playerCount={game.playerCount}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
