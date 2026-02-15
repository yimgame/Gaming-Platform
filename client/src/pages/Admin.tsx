import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import type { GameConfig, GameStatus } from "@shared/games-config";

const createEmptyGame = (id: string, title: string): GameConfig => ({
  id,
  title,
  description: "Nuevo juego",
  longDescription: "Descripción pendiente",
  cardImage: "/quake3-hero.jpg",
  backgroundImage: "/quake3-hero.jpg",
  connectUrl: "",
  status: "offline",
  playerCount: "0/0",
  tags: [],
  features: [],
  paths: {
    basePath: "",
    statsPath: "",
    screenshotsPath: "",
    demosPath: "",
  },
  supportsQuakeStats: false,
});

export default function AdminPage() {
  const queryClient = useQueryClient();

  const [tokenInput, setTokenInput] = useState(() => {
    return window.localStorage.getItem("adminToken") || "";
  });

  const [activeToken, setActiveToken] = useState(() => {
    return window.localStorage.getItem("adminToken") || "";
  });

  const [newGameId, setNewGameId] = useState("");
  const [newGameTitle, setNewGameTitle] = useState("");
  const [activeGameId, setActiveGameId] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, GameConfig>>({});

  const adminStatusQuery = useQuery<{ enabled: boolean }>({
    queryKey: ["admin-status-page", activeToken],
    queryFn: async () => {
      if (!activeToken.trim()) return { enabled: false };
      const response = await fetch("/api/admin/status", {
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        return { enabled: false };
      }

      return response.json();
    },
    enabled: activeToken.trim().length > 0,
  });

  const isEnabled = Boolean(adminStatusQuery.data?.enabled);
  const adminConfigQuery = useQuery<{
    quakeBasePath: string;
    quake2BasePath: string;
    quake3BasePath: string;
    counter16BasePath: string;
    cs2BasePath: string;
    minecraftBasePath: string;
    statsPath: string;
    screenshotsPath: string;
    demosPath: string;
  }>({
    queryKey: ["admin-config", activeToken],
    queryFn: async () => {
      const response = await fetch("/api/admin/config", {
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo leer la configuración admin");
      }

      return response.json();
    },
    enabled: isEnabled,
  });

  const adminGamesQuery = useQuery<{ games: GameConfig[] }>({
    queryKey: ["admin-games", activeToken],
    queryFn: async () => {
      const response = await fetch("/api/admin/games", {
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo leer el catálogo de juegos");
      }

      return response.json();
    },
    enabled: isEnabled,
  });

  useEffect(() => {
    const games = adminGamesQuery.data?.games;
    if (!games || games.length === 0) {
      setDrafts({});
      setActiveGameId("");
      return;
    }

    const nextDrafts: Record<string, GameConfig> = {};
    for (const game of games) {
      nextDrafts[game.id] = game;
    }

    setDrafts(nextDrafts);
    setActiveGameId((current) => (current && nextDrafts[current] ? current : games[0].id));
  }, [adminGamesQuery.data]);

  const saveGameMutation = useMutation({
    mutationFn: async (game: GameConfig) => {
      const response = await fetch(`/api/admin/games/${game.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": activeToken,
        },
        body: JSON.stringify({
          title: game.title,
          description: game.description,
          longDescription: game.longDescription,
          cardImage: game.cardImage,
          backgroundImage: game.backgroundImage,
          connectUrl: game.connectUrl,
          status: game.status,
          playerCount: game.playerCount,
          tags: game.tags,
          features: game.features,
          paths: game.paths,
          supportsQuakeStats: game.supportsQuakeStats,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar el juego");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-games", activeToken] });
      await queryClient.invalidateQueries({ queryKey: ["games-catalog"] });
    },
  });

  const createGameMutation = useMutation({
    mutationFn: async () => {
      const id = newGameId.trim();
      const title = newGameTitle.trim();

      if (!id || !title) {
        throw new Error("Completá ID y título");
      }

      const response = await fetch("/api/admin/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": activeToken,
        },
        body: JSON.stringify(createEmptyGame(id, title)),
      });

      if (!response.ok) {
        throw new Error("No se pudo crear el juego");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      setNewGameId("");
      setNewGameTitle("");
      await queryClient.invalidateQueries({ queryKey: ["admin-games", activeToken] });
      await queryClient.invalidateQueries({ queryKey: ["games-catalog"] });
      if (data?.game?.id) {
        setActiveGameId(data.game.id);
      }
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/games/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo borrar el juego");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-games", activeToken] });
      await queryClient.invalidateQueries({ queryKey: ["games-catalog"] });
    },
  });

  const updateDraft = (id: string, patch: Partial<GameConfig>) => {
    setDrafts((current) => {
      const prev = current[id];
      if (!prev) return current;
      return {
        ...current,
        [id]: {
          ...prev,
          ...patch,
        },
      };
    });
  };

  const updateDraftPaths = (id: string, patch: Partial<NonNullable<GameConfig["paths"]>>) => {
    setDrafts((current) => {
      const prev = current[id];
      if (!prev) return current;
      return {
        ...current,
        [id]: {
          ...prev,
          paths: {
            ...(prev.paths || {}),
            ...patch,
          },
        },
      };
    });
  };

  const parseList = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
  const parseTags = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

  const handleActivate = async () => {
    const value = tokenInput.trim();
    if (!value) {
      window.alert("Ingresá el token admin");
      return;
    }

    const response = await fetch("/api/admin/status", {
      headers: {
        "x-admin-token": value,
      },
    });

    if (!response.ok) {
      window.alert("Token inválido");
      return;
    }

    const data = await response.json();
    if (!data?.enabled) {
      window.alert("Token inválido");
      return;
    }

    window.localStorage.setItem("adminToken", value);
    setActiveToken(value);
  };

  const handleClear = () => {
    window.localStorage.removeItem("adminToken");
    setTokenInput("");
    setActiveToken("");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Panel Admin</h1>
          <Link href="/games/quake-3-arena">
            <Button variant="outline" size="sm">Volver al juego</Button>
          </Link>
        </div>

        <Card className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Activá el token para habilitar acciones manuales (asociar demo/captura) en los detalles de partida.
          </p>

          <Input
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="Admin token"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleActivate}>Activar token</Button>
            <Button variant="outline" onClick={handleClear}>Desactivar</Button>
          </div>

          <p className="text-sm">
            Estado: {isEnabled ? "Admin activo" : "Admin inactivo"}
          </p>

          {isEnabled && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-semibold">Rutas base del juego</p>

              {adminConfigQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Cargando configuración...</p>
              ) : adminConfigQuery.error ? (
                <p className="text-xs text-destructive">No se pudo cargar la configuración</p>
              ) : adminConfigQuery.data ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">QUAKE_BASE_PATH</p>
                    <Input value={adminConfigQuery.data.quakeBasePath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">QUAKE2_BASE_PATH</p>
                    <Input value={adminConfigQuery.data.quake2BasePath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">QUAKE3_BASE_PATH</p>
                    <Input value={adminConfigQuery.data.quake3BasePath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">COUNTER16_BASE_PATH</p>
                    <Input value={adminConfigQuery.data.counter16BasePath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">CS2_BASE_PATH</p>
                    <Input value={adminConfigQuery.data.cs2BasePath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">MINECRAFT_BASE_PATH</p>
                    <Input value={adminConfigQuery.data.minecraftBasePath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">STATS_PATH</p>
                    <Input value={adminConfigQuery.data.statsPath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">SCREENSHOTS_PATH</p>
                    <Input value={adminConfigQuery.data.screenshotsPath} readOnly className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">DEMOS_PATH</p>
                    <Input value={adminConfigQuery.data.demosPath} readOnly className="h-8 text-xs" />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        {isEnabled && (
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Gestión de juegos</p>
              <p className="text-xs text-muted-foreground">
                Cada pestaña es una hoja de configuración. Podés agregar, quitar y guardar cambios por juego.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={newGameId}
                onChange={(event) => setNewGameId(event.target.value)}
                placeholder="ID (ej: quake-live)"
              />
              <Input
                value={newGameTitle}
                onChange={(event) => setNewGameTitle(event.target.value)}
                placeholder="Título"
              />
              <Button
                onClick={() => createGameMutation.mutate()}
                disabled={createGameMutation.isPending}
              >
                Agregar juego
              </Button>
            </div>

            {adminGamesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando juegos...</p>
            ) : adminGamesQuery.error ? (
              <p className="text-sm text-destructive">No se pudo cargar juegos</p>
            ) : adminGamesQuery.data?.games?.length ? (
              <Tabs value={activeGameId} onValueChange={setActiveGameId} className="space-y-4">
                <TabsList className="h-auto flex-wrap justify-start">
                  {adminGamesQuery.data.games.map((game) => (
                    <TabsTrigger key={game.id} value={game.id}>
                      {game.title}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {adminGamesQuery.data.games.map((game) => {
                  const draft = drafts[game.id] || game;

                  return (
                    <TabsContent key={game.id} value={game.id}>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">ID</p>
                          <Input value={draft.id} readOnly className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Título</p>
                          <Input value={draft.title} onChange={(e) => updateDraft(game.id, { title: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div className="lg:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Descripción corta</p>
                          <Input value={draft.description} onChange={(e) => updateDraft(game.id, { description: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div className="lg:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Descripción larga</p>
                          <textarea
                            value={draft.longDescription}
                            onChange={(e) => updateDraft(game.id, { longDescription: e.target.value })}
                            className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Imagen tarjeta</p>
                          <Input value={draft.cardImage} onChange={(e) => updateDraft(game.id, { cardImage: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Imagen fondo</p>
                          <Input value={draft.backgroundImage} onChange={(e) => updateDraft(game.id, { backgroundImage: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Connect URL</p>
                          <Input value={draft.connectUrl || ""} onChange={(e) => updateDraft(game.id, { connectUrl: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Jugadores (ej: 0/16)</p>
                          <Input value={draft.playerCount} onChange={(e) => updateDraft(game.id, { playerCount: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Estado</p>
                          <select
                            value={draft.status}
                            onChange={(e) => updateDraft(game.id, { status: e.target.value as GameStatus })}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="online">online</option>
                            <option value="offline">offline</option>
                            <option value="maintenance">maintenance</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <input
                            id={`qstats-${game.id}`}
                            type="checkbox"
                            checked={draft.supportsQuakeStats}
                            onChange={(e) => updateDraft(game.id, { supportsQuakeStats: e.target.checked })}
                          />
                          <label htmlFor={`qstats-${game.id}`} className="text-xs text-muted-foreground">Habilitar tabs de stats/partidas/media Quake</label>
                        </div>
                        <div className="lg:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Tags (separados por coma)</p>
                          <Input
                            value={draft.tags.join(", ")}
                            onChange={(e) => updateDraft(game.id, { tags: parseTags(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Features (una por línea)</p>
                          <textarea
                            value={draft.features.join("\n")}
                            onChange={(e) => updateDraft(game.id, { features: parseList(e.target.value) })}
                            className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">BASE_PATH</p>
                          <Input value={draft.paths?.basePath || ""} onChange={(e) => updateDraftPaths(game.id, { basePath: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">STATS_PATH</p>
                          <Input value={draft.paths?.statsPath || ""} onChange={(e) => updateDraftPaths(game.id, { statsPath: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">SCREENSHOTS_PATH</p>
                          <Input value={draft.paths?.screenshotsPath || ""} onChange={(e) => updateDraftPaths(game.id, { screenshotsPath: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">DEMOS_PATH</p>
                          <Input value={draft.paths?.demosPath || ""} onChange={(e) => updateDraftPaths(game.id, { demosPath: e.target.value })} className="h-8 text-xs" />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => saveGameMutation.mutate(draft)}
                          disabled={saveGameMutation.isPending}
                        >
                          Guardar cambios
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            const confirmDelete = window.confirm(`¿Eliminar ${draft.title}?`);
                            if (confirmDelete) {
                              deleteGameMutation.mutate(draft.id);
                            }
                          }}
                          disabled={deleteGameMutation.isPending}
                        >
                          Quitar juego
                        </Button>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground">No hay juegos cargados.</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
