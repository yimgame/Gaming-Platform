import { z } from "zod";

export const GameStatusSchema = z.enum(["online", "offline", "maintenance"]);

export const GamePathsSchema = z.object({
  basePath: z.string().optional(),
  statsPath: z.string().optional(),
  screenshotsPath: z.string().optional(),
  demosPath: z.string().optional(),
});

export const GameDownloadLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  description: z.string().optional(),
});

export const GameConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  longDescription: z.string().min(1),
  cardImage: z.string().min(1),
  backgroundImage: z.string().min(1),
  connectUrl: z.string().optional(),
  status: GameStatusSchema,
  playerCount: z.string().min(1),
  tags: z.array(z.string()),
  features: z.array(z.string()),
  paths: GamePathsSchema.optional(),
  // Links de descarga (juego base, motor recomendado, mods) que se muestran
  // como botones en la pestaña "Información" de la ficha del juego.
  downloads: z.array(GameDownloadLinkSchema).optional(),
  supportsQuakeStats: z.boolean().default(false),
  supportsCs16Status: z.boolean().default(false),
  supportsMinecraftStatus: z.boolean().default(false),
});

export const GamesConfigSchema = z.array(GameConfigSchema);

export type GameStatus = z.infer<typeof GameStatusSchema>;
export type GamePaths = z.infer<typeof GamePathsSchema>;
export type GameDownloadLink = z.infer<typeof GameDownloadLinkSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;

export const CreateGameConfigSchema = GameConfigSchema;
export const UpdateGameConfigSchema = GameConfigSchema.omit({ id: true });

