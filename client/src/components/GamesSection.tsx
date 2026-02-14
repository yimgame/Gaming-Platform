import GameCard from "./GameCard";
import { useQuery } from "@tanstack/react-query";
import type { QuakeServerStatus } from "@shared/stats-schema";

// Using placeholders for now. User should upload real screenshots later.
const games = [
  {
    title: "Counter Strike 1.6",
    description: "El clásico de siempre. Servidor público, mapas custom, baja latencia y la mejor comunidad.",
    tags: ["FPS", "Classic", "Fast Paced"],
    image: "cs16.jpg", // Imagen personalizada de CS 1.6
    connectUrl: "steam://connect/yim.servegame.com:27015",
    status: "online" as const,
    playerCount: "12/32"
  },
  {
    title: "Counter Strike 2",
    description: "La nueva generación de CS. Gráficos mejorados, tickrate dinámico y matchmaking competitivo.",
    tags: ["FPS", "Modern", "Competitive"],
    image: "cs2.jpg", // Imagen personalizada de CS 2
    connectUrl: "steam://connect/yim.servegame.com:27016",
    status: "online" as const,
    playerCount: "5/10"
  },
  {
    title: "Minecraft Survival",
    description: "Mundo survival infinito. Plugins de protección, economía y eventos semanales. Versión Java & Bedrock.",
    tags: ["Survival", "Sandbox", "Creative"],
    image: "minecraft.jpg", // TODO: ajustar la Imagen personalizada de Minecraft
    connectUrl: "minecraft://connect/yim.servegame.com",
    status: "online" as const,
    playerCount: "25/100"
  },
  {
    title: "Quake 2",
    description: "Acción frenética en la arena. Railgun instagib, CTF y más modos clásicos.",
    tags: ["Arena", "Retro", "Fast"],
    image: "quake2-hero.jpg", // Imagen personalizada de Quake 2
    connectUrl: "#",
    status: "maintenance" as const,
    playerCount: "0/16"
  },
  {
    title: "Quake 3 Arena",
    description: "El rey de los arena shooters. Rocket jumps, strafe jumping y torneos mensuales.",
    tags: ["Arena", "Competitive", "Esports"],
    //image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=2047&auto=format&fit=crop",
    image: "quake3-hero.jpg", // Imagen personalizada de Quake 3
    connectUrl: "#",
    status: "offline" as const,
    playerCount: "0/16"
  },
  {
    title: "Quake 1 (QuakeWorld)",
    description: "Donde todo comenzó. Física pura, bunny hopping y duelos 1v1 intensos.",
    tags: ["Retro", "Classic", "Arena"],
    image: "quake1-hero.jpg", // Imagen personalizada de Quake 1
    connectUrl: "#",
    status: "offline" as const,
    playerCount: "0/16"
  },
];

export default function GamesSection() {
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

  // Actualizar datos de Quake 3 con el estado real del servidor
  const gamesWithLiveData = games.map(game => {
    if (game.title === "Quake 3 Arena" && q3aStatus) {
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
            <GameCard key={game.title} {...game} />
          ))}
        </div>
      </div>
    </section>
  );
}
