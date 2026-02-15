import fs from "node:fs/promises";
import path from "node:path";
import {
  type GameConfig,
  CreateGameConfigSchema,
  GamesConfigSchema,
  UpdateGameConfigSchema,
} from "../shared/games-config";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "games-config.json");

const defaultGames: GameConfig[] = [
  {
    id: "quake-3-arena",
    title: "Quake 3 Arena",
    description: "El rey de los arena shooters. Rocket jumps, strafe jumping y torneos mensuales.",
    longDescription:
      "Quake III Arena es un shooter multijugador de ritmo rápido que definió el género de los arena shooters. Con su física única, movimiento avanzado y combate frenético, sigue siendo uno de los juegos competitivos más emocionantes.",
    cardImage: "/quake3-hero.jpg",
    backgroundImage: "/quake3-hero.jpg",
    connectUrl: "#",
    status: "offline",
    playerCount: "0/16",
    tags: ["Arena", "Competitive", "Esports"],
    features: [
      "CPMA (Challenge ProMode Arena)",
      "Servidor dedicado 24/7",
      "Estadísticas detalladas",
      "Rankings globales y por partida",
      "Múltiples modos: CTF, TDM, FFA",
      "Mapas clásicos y custom",
    ],
    paths: {
      basePath: "G:\\Games\\Quake3\\cpma",
      statsPath: "G:\\Games\\Quake3\\cpma\\stats",
      screenshotsPath: "G:\\Games\\Quake3\\cpma\\screenshots",
      demosPath: "G:\\Games\\Quake3\\cpma\\demos",
    },
    supportsQuakeStats: true,
  },
  {
    id: "counter-strike-1-6",
    title: "Counter Strike 1.6",
    description: "El clásico de siempre. Servidor público, mapas custom, baja latencia.",
    longDescription:
      "Counter-Strike 1.6 es el FPS táctico que definió una generación. Combates intensos 5v5, estrategia de equipo y habilidad individual se combinan en el shooter competitivo más icónico de todos los tiempos.",
    cardImage: "cs16.jpg",
    backgroundImage:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "steam://connect/yim.servegame.com:27015",
    status: "online",
    playerCount: "12/32",
    tags: ["FPS", "Classic", "Fast Paced"],
    features: [
      "Servidor público dedicado",
      "Mapas clásicos y custom",
      "Baja latencia",
      "Comunidad activa",
      "Mod personalizado",
      "Anti-cheat activo",
    ],
    paths: {
      basePath: "G:\\Games\\Counter-Strike 1.6\\cstrike",
    },
    supportsQuakeStats: false,
  },
  {
    id: "counter-strike-2",
    title: "Counter Strike 2",
    description: "La nueva generación de CS. Gráficos mejorados, tickrate dinámico.",
    longDescription:
      "Counter-Strike 2 marca el inicio de una nueva era para el FPS competitivo más grande del mundo. Construido sobre Source 2, ofrece gráficos mejorados, físicas actualizadas y la misma jugabilidad táctica que amas.",
    cardImage: "cs2.jpg",
    backgroundImage:
      "https://images.unsplash.com/photo-1616514934832-60298a4bb238?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "steam://connect/yim.servegame.com:27016",
    status: "online",
    playerCount: "5/10",
    tags: ["FPS", "Modern", "Competitive"],
    features: [
      "Gráficos Source 2",
      "Tickrate dinámico",
      "Matchmaking competitivo",
      "Mapas renovados",
      "Sistema de rangos",
      "Sub-tick updates",
    ],
    paths: {
      basePath: "G:\\Games\\cs2\\cs2",
    },
    supportsQuakeStats: false,
  },
  {
    id: "minecraft-survival",
    title: "Minecraft Survival",
    description: "Mundo survival infinito. Plugins de protección, economía y eventos.",
    longDescription:
      "Explora un mundo infinito de posibilidades en nuestro servidor Survival. Construye, explora, comercia y sobrevive junto a una comunidad activa. Con plugins de protección y economía para una experiencia equilibrada.",
    cardImage: "minecraft.jpg",
    backgroundImage:
      "https://images.unsplash.com/photo-1607525388365-18ae415b3c54?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "minecraft://connect/yim.servegame.com",
    status: "online",
    playerCount: "25/100",
    tags: ["Survival", "Sandbox", "Creative"],
    features: [
      "Mundo infinito",
      "Protección de terrenos",
      "Economía del servidor",
      "Eventos semanales",
      "Java & Bedrock",
      "Sin lag, alto rendimiento",
    ],
    paths: {
      basePath: "G:\\Games\\Minecraft",
    },
    supportsQuakeStats: false,
  },
  {
    id: "quake-2",
    title: "Quake 2",
    description: "Acción frenética en la arena. Railgun instagib, CTF y más modos.",
    longDescription:
      "Quake II revolucionó los shooters multijugador con su combate rápido y mapas icónicos. Experimenta la acción clásica con railgun instagib, CTF y más modos competitivos.",
    cardImage: "quake2-hero.jpg",
    backgroundImage:
      "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "#",
    status: "maintenance",
    playerCount: "0/16",
    tags: ["Arena", "Retro", "Fast"],
    features: [
      "Railgun Instagib",
      "Capture The Flag",
      "Mapas clásicos",
      "Física retro auténtica",
      "Duelos 1v1",
      "Competitivo",
    ],
    paths: {
      basePath: "G:\\Games\\Quake2\\baseq2",
    },
    supportsQuakeStats: false,
  },
  {
    id: "quake-1",
    title: "Quake 1 (QuakeWorld)",
    description: "Donde todo comenzó. Física pura, bunny hopping y duelos 1v1.",
    longDescription:
      "El origen de todos los arena shooters. QuakeWorld ofrece la física más pura, bunny hopping perfecto y duelos 1v1 intensos que han resistido la prueba del tiempo.",
    cardImage: "quake1-hero.jpg",
    backgroundImage:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
    connectUrl: "#",
    status: "offline",
    playerCount: "0/16",
    tags: ["Retro", "Classic", "Arena"],
    features: [
      "QuakeWorld physics",
      "Bunny hopping",
      "Duelos 1v1 intensos",
      "Movimiento técnico",
      "Arena shooter original",
      "Leyenda viviente",
    ],
    paths: {
      basePath: "G:\\Games\\Quake\\id1",
    },
    supportsQuakeStats: false,
  },
];

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultGames, null, 2), "utf-8");
  }
}

export async function getGamesConfig(): Promise<GameConfig[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return GamesConfigSchema.parse(JSON.parse(raw));
}

async function writeGamesConfig(games: GameConfig[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(games, null, 2), "utf-8");
}

export async function createGameConfig(input: unknown): Promise<GameConfig> {
  const newGame = CreateGameConfigSchema.parse(input);
  const games = await getGamesConfig();

  if (games.some((game) => game.id === newGame.id)) {
    throw new Error("Game id already exists");
  }

  const updated = [...games, newGame];
  await writeGamesConfig(updated);
  return newGame;
}

export async function updateGameConfig(id: string, input: unknown): Promise<GameConfig> {
  const changes = UpdateGameConfigSchema.parse(input);
  const games = await getGamesConfig();

  const index = games.findIndex((game) => game.id === id);
  if (index < 0) {
    throw new Error("Game not found");
  }

  const updatedGame: GameConfig = {
    ...changes,
    id,
  };

  games[index] = updatedGame;
  await writeGamesConfig(games);
  return updatedGame;
}

export async function deleteGameConfig(id: string): Promise<void> {
  const games = await getGamesConfig();
  const remaining = games.filter((game) => game.id !== id);

  if (remaining.length === games.length) {
    throw new Error("Game not found");
  }

  await writeGamesConfig(remaining);
}
