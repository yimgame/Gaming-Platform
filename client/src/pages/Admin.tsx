import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import type { GameConfig, GameStatus } from "@shared/games-config";
import type { ContactMessage } from "@shared/schema";
import {
  DEFAULT_SITE_SETTINGS,
  SiteSettingsSchema,
  type SiteSettingsData,
} from "@shared/site-settings";

type ServerStatus = {
  online: boolean;
  hostname?: string;
  mapname?: string;
  maxClients?: number;
  clients?: number;
};

type LevelshotOverride = {
  mapName: string;
  imageUrl: string;
  updatedAt: string;
};

type MatchSummary = {
  map: string;
  datetime: string;
};

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

  const parseJsonResponse = async (response: Response, fallbackMessage: string) => {
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    if (!contentType.includes("application/json")) {
      throw new Error("La API devolvió HTML en vez de JSON. Reiniciá backend/dev server.");
    }

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(fallbackMessage);
    }
  };

  const [tokenInput, setTokenInput] = useState(() => {
    return window.localStorage.getItem("adminToken") || "";
  });

  const [activeToken, setActiveToken] = useState(() => {
    return window.localStorage.getItem("adminToken") || "";
  });

  const [newGameId, setNewGameId] = useState("");
  const [newGameTitle, setNewGameTitle] = useState("");
  const [activeGameId, setActiveGameId] = useState<string>("");
  const [activeSection, setActiveSection] = useState("estado");
  const [newLevelshotMap, setNewLevelshotMap] = useState("");
  const [newLevelshotUrl, setNewLevelshotUrl] = useState("");
  const [newLevelshotFile, setNewLevelshotFile] = useState<File | null>(null);
  const [newLevelshotPreviewUrl, setNewLevelshotPreviewUrl] = useState("");
  const [newLevelshotPreviewFailed, setNewLevelshotPreviewFailed] = useState(false);
  const [didAutoFillCurrentMap, setDidAutoFillCurrentMap] = useState(false);
  const [currentMapSuggestionSource, setCurrentMapSuggestionSource] = useState<"lvlworld" | "efservers">("lvlworld");
  const [suggestionSourceByMap, setSuggestionSourceByMap] = useState<Record<string, "lvlworld" | "efservers">>({});
  const levelshotFileInputRef = useRef<HTMLInputElement | null>(null);
  const [drafts, setDrafts] = useState<Record<string, GameConfig>>({});
  const [siteDraft, setSiteDraft] = useState<SiteSettingsData>(DEFAULT_SITE_SETTINGS);
  const manualLevelshotPreviewUrl = newLevelshotFile
    ? ""
    : newLevelshotUrl.trim();
  const canPreviewManualLevelshot =
    manualLevelshotPreviewUrl.startsWith("/") ||
    /^https?:\/\//i.test(manualLevelshotPreviewUrl);
  const activeLevelshotPreviewUrl = newLevelshotPreviewUrl || (canPreviewManualLevelshot ? manualLevelshotPreviewUrl : "");

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

  const adminSiteSettingsQuery = useQuery<{ settings: SiteSettingsData }>({
    queryKey: ["admin-site-settings", activeToken],
    queryFn: async () => {
      const response = await fetch("/api/admin/site-settings", {
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo leer la configuración del sitio");
      }

      const payload = await response.json();
      return { settings: SiteSettingsSchema.parse(payload.settings) };
    },
    enabled: isEnabled,
  });

  const adminMessagesQuery = useQuery<{ messages: ContactMessage[] }>({
    queryKey: ["admin-contact-messages", activeToken],
    queryFn: async () => {
      const response = await fetch("/api/admin/contact-messages?limit=200", {
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudieron leer los mensajes");
      }

      return response.json();
    },
    enabled: isEnabled,
  });

  const serverStatusQuery = useQuery<ServerStatus>({
    queryKey: ["admin-server-status"],
    queryFn: async () => {
      const response = await fetch("/api/server/status");
      if (!response.ok) {
        throw new Error("No se pudo leer el estado del servidor");
      }
      return response.json();
    },
    enabled: isEnabled,
    refetchInterval: 30000,
  });

  const adminLevelshotsQuery = useQuery<{ levelshots: LevelshotOverride[] }>({
    queryKey: ["admin-levelshots", activeToken],
    queryFn: async () => {
      const response = await fetch("/api/admin/levelshots", {
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (response.status === 404) {
        return { levelshots: [] };
      }

      if (!response.ok) {
        let detail = "No se pudieron leer los levelshots";
        try {
          const payload = await parseJsonResponse(response, detail);
          if (payload?.error) {
            detail = String(payload.error);
          }
        } catch {
          // ignorar parseo fallido y usar mensaje por defecto
        }
        throw new Error(detail);
      }

      const payload = await parseJsonResponse(response, "No se pudo parsear la tabla de levelshots");
      const levelshots = Array.isArray(payload.levelshots)
        ? (payload.levelshots as LevelshotOverride[])
        : [];

      return { levelshots };
    },
    enabled: isEnabled,
  });

  const recentMatchesQuery = useQuery<{ matches: MatchSummary[] }>({
    queryKey: ["admin-recent-matches-for-levelshots"],
    queryFn: async () => {
      const response = await fetch("/api/stats/matches");
      if (!response.ok) {
        throw new Error("No se pudieron leer partidas recientes");
      }

      const payload = await parseJsonResponse(response, "No se pudieron parsear partidas recientes");
      const matches = Array.isArray(payload.matches)
        ? (payload.matches as MatchSummary[])
        : [];

      return { matches };
    },
    enabled: isEnabled && activeSection === "levelshots",
  });

  const levelshotOverrideMapSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of adminLevelshotsQuery.data?.levelshots || []) {
      set.add(item.mapName.toLowerCase());
    }
    return set;
  }, [adminLevelshotsQuery.data?.levelshots]);

  const getLvlworldUrlForMap = (mapName: string) => {
    const map = mapName.trim().toLowerCase();
    return map ? `https://lvlworld.com/levels/${map}/${map}lg.jpg` : "";
  };

  const getEfserversUrlForMap = (mapName: string) => {
    const map = mapName.trim().toLowerCase();
    return map ? `https://efservers.com/levelshots/${map}.jpg` : "";
  };

  const getQ3dfUrlForMap = (mapName: string) => {
    const map = mapName.trim().toLowerCase();
    return map ? `https://ws.q3df.org/images/levelshots/512x384/${map}.jpg` : "";
  };

  const currentMapName = String(serverStatusQuery.data?.mapname || "").trim().toLowerCase();
  const currentMapNeedsSuggestion = Boolean(
    currentMapName && !levelshotOverrideMapSet.has(currentMapName),
  );

  const suggestedLevelshots = useMemo(() => {
    const suggestions: Array<{ mapName: string; lvlworldUrl: string; efserversUrl: string; q3dfUrl: string }> = [];
    const seen = new Set<string>();

    for (const match of recentMatchesQuery.data?.matches || []) {
      const mapName = String(match.map || "").trim().toLowerCase();
      if (!mapName || seen.has(mapName)) continue;
      seen.add(mapName);

      if (levelshotOverrideMapSet.has(mapName)) continue;
      suggestions.push({
        mapName,
        lvlworldUrl: getLvlworldUrlForMap(mapName),
        efserversUrl: getEfserversUrlForMap(mapName),
        q3dfUrl: getQ3dfUrlForMap(mapName),
      });
      if (suggestions.length >= 12) break;
    }

    return suggestions;
  }, [recentMatchesQuery.data?.matches, levelshotOverrideMapSet]);

  useEffect(() => {
    setCurrentMapSuggestionSource("lvlworld");
  }, [currentMapName]);

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

  useEffect(() => {
    if (adminSiteSettingsQuery.data?.settings) {
      setSiteDraft(adminSiteSettingsQuery.data.settings);
    }
  }, [adminSiteSettingsQuery.data]);

  useEffect(() => {
    if (!newLevelshotFile) {
      setNewLevelshotPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(newLevelshotFile);
    setNewLevelshotPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [newLevelshotFile]);

  useEffect(() => {
    setNewLevelshotPreviewFailed(false);
  }, [newLevelshotPreviewUrl, manualLevelshotPreviewUrl]);

  useEffect(() => {
    if (activeSection !== "levelshots") {
      setDidAutoFillCurrentMap(false);
      return;
    }

    if (didAutoFillCurrentMap) return;
    if (!currentMapNeedsSuggestion) return;
    if (newLevelshotMap.trim() || newLevelshotUrl.trim() || newLevelshotFile) return;

    const suggestionUrl = getLvlworldUrlForMap(currentMapName);
    if (!suggestionUrl) return;

    setNewLevelshotMap(currentMapName);
    setNewLevelshotUrl(suggestionUrl);
    setDidAutoFillCurrentMap(true);
  }, [
    activeSection,
    didAutoFillCurrentMap,
    currentMapNeedsSuggestion,
    newLevelshotMap,
    newLevelshotUrl,
    newLevelshotFile,
    currentMapName,
  ]);

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

  const saveSiteSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": activeToken,
        },
        body: JSON.stringify(siteDraft),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar la configuración del sitio");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-site-settings", activeToken] });
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
  });

  const saveLevelshotMutation = useMutation({
    mutationFn: async () => {
      const mapName = newLevelshotMap.trim();
      let imageUrl = newLevelshotUrl.trim();

      if (!mapName) {
        throw new Error("Completá mapa");
      }

      if (newLevelshotFile) {
        const formData = new FormData();
        formData.append("image", newLevelshotFile);
        formData.append("mapName", mapName);

        const uploadResponse = await fetch("/api/admin/levelshots/upload", {
          method: "POST",
          headers: {
            "x-admin-token": activeToken,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("No se pudo subir la imagen seleccionada");
        }

        const uploadPayload = await parseJsonResponse(uploadResponse, "No se pudo parsear la subida");
        const uploadedUrl = String(uploadPayload.imageUrl || "").trim();
        if (!uploadedUrl) {
          throw new Error("La subida no devolvió URL de imagen");
        }

        imageUrl = uploadedUrl;
      }

      if (!imageUrl) {
        throw new Error("Completá mapa e imagen");
      }

      const response = await fetch("/api/admin/levelshots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": activeToken,
        },
        body: JSON.stringify({ mapName, imageUrl }),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar el levelshot");
      }

      return parseJsonResponse(response, "No se pudo parsear la respuesta de levelshot");
    },
    onSuccess: async () => {
      setNewLevelshotMap("");
      setNewLevelshotUrl("");
      setNewLevelshotFile(null);
      if (levelshotFileInputRef.current) {
        levelshotFileInputRef.current.value = "";
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-levelshots", activeToken] });
    },
  });

  const saveSuggestedLevelshotMutation = useMutation({
    mutationFn: async ({ mapName, imageUrl }: { mapName: string; imageUrl: string }) => {
      const response = await fetch("/api/admin/levelshots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": activeToken,
        },
        body: JSON.stringify({ mapName, imageUrl }),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar la sugerencia");
      }

      return parseJsonResponse(response, "No se pudo parsear la sugerencia guardada");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-levelshots", activeToken] });
    },
  });

  const deleteLevelshotMutation = useMutation({
    mutationFn: async (mapName: string) => {
      const response = await fetch(`/api/admin/levelshots/${encodeURIComponent(mapName)}`, {
        method: "DELETE",
        headers: {
          "x-admin-token": activeToken,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar el levelshot");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-levelshots", activeToken] });
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
  const parseLines = (value: string) => value.split("\n");
  const updateSiteDraft = (patch: Partial<SiteSettingsData>) => {
    setSiteDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const applyLvlworldTemplate = () => {
    const map = newLevelshotMap.trim().toLowerCase();
    if (!map) {
      window.alert("Primero ingresá el nombre del mapa");
      return;
    }

    setNewLevelshotFile(null);
    if (levelshotFileInputRef.current) {
      levelshotFileInputRef.current.value = "";
    }

    setNewLevelshotUrl(getLvlworldUrlForMap(map));
  };

  const applyEfserversTemplate = () => {
    const map = newLevelshotMap.trim().toLowerCase();
    if (!map) {
      window.alert("Primero ingresá el nombre del mapa");
      return;
    }

    setNewLevelshotFile(null);
    if (levelshotFileInputRef.current) {
      levelshotFileInputRef.current.value = "";
    }

    setNewLevelshotUrl(getEfserversUrlForMap(map));
  };

  const applyQ3dfTemplate = () => {
    const map = newLevelshotMap.trim().toLowerCase();
    if (!map) {
      window.alert("Primero ingresá el nombre del mapa");
      return;
    }

    setNewLevelshotFile(null);
    if (levelshotFileInputRef.current) {
      levelshotFileInputRef.current.value = "";
    }

    setNewLevelshotUrl(getQ3dfUrlForMap(map));
  };

  const fillCurrentMap = () => {
    const map = currentMapName;
    if (!map) {
      window.alert("No hay mapa actual disponible en el servidor");
      return;
    }

    setNewLevelshotMap(map);
    setNewLevelshotUrl(getLvlworldUrlForMap(map));
    setDidAutoFillCurrentMap(true);
  };

  const clearLevelshotForm = () => {
    setNewLevelshotMap("");
    setNewLevelshotUrl("");
    setNewLevelshotFile(null);
    setNewLevelshotPreviewUrl("");
    setNewLevelshotPreviewFailed(false);
    setDidAutoFillCurrentMap(false);
    if (levelshotFileInputRef.current) {
      levelshotFileInputRef.current.value = "";
    }
  };

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
        </Card>

        {isEnabled && (
          <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="estado">1) Estado</TabsTrigger>
              <TabsTrigger value="mensajes">2) Mensajes</TabsTrigger>
              <TabsTrigger value="sitio">3) Configuración del sitio</TabsTrigger>
              <TabsTrigger value="config">4) Config juegos</TabsTrigger>
              <TabsTrigger value="agregar">5) Agregar juego</TabsTrigger>
              <TabsTrigger value="levelshots">6) Levelshots</TabsTrigger>
            </TabsList>

            <TabsContent value="estado" className="space-y-4">
              <Card className="p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Estado del servidor</p>
                  <p className="text-xs text-muted-foreground">Resumen del endpoint /api/server/status.</p>
                </div>

                {serverStatusQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Consultando estado del servidor...</p>
                ) : serverStatusQuery.error ? (
                  <p className="text-sm text-destructive">No se pudo leer el estado del servidor</p>
                ) : serverStatusQuery.data ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p>Online: {serverStatusQuery.data.online ? "Sí" : "No"}</p>
                    <p>Mapa: {String(serverStatusQuery.data.mapname || "-")}</p>
                    <p>Jugadores: {String(serverStatusQuery.data.clients || 0)} / {String(serverStatusQuery.data.maxClients || 0)}</p>
                    <p>Hostname: {String(serverStatusQuery.data.hostname || "-")}</p>
                  </div>
                ) : null}
              </Card>

              <Card className="p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Juegos corriendo</p>
                  <p className="text-xs text-muted-foreground">Juegos del catálogo con estado online.</p>
                </div>

                {adminGamesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando juegos...</p>
                ) : adminGamesQuery.error ? (
                  <p className="text-sm text-destructive">No se pudo cargar juegos</p>
                ) : (adminGamesQuery.data?.games || []).filter((game) => game.status === "online").length ? (
                  <div className="space-y-2">
                    {(adminGamesQuery.data?.games || [])
                      .filter((game) => game.status === "online")
                      .map((game) => (
                        <div key={game.id} className="rounded-md border border-border p-3 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{game.title}</p>
                          <p className="text-xs text-muted-foreground">{game.playerCount}</p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay juegos en estado online.</p>
                )}
              </Card>

              <Card className="p-4 space-y-3">
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
              </Card>
            </TabsContent>

            <TabsContent value="mensajes">
              <Card className="p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Mensajes de contacto</p>
                  <p className="text-xs text-muted-foreground">
                    Los mensajes del formulario se guardan en PostgreSQL y se muestran acá.
                  </p>
                </div>

                {adminMessagesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando mensajes...</p>
                ) : adminMessagesQuery.error ? (
                  <p className="text-sm text-destructive">No se pudieron cargar los mensajes</p>
                ) : adminMessagesQuery.data?.messages?.length ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {adminMessagesQuery.data.messages.map((item) => (
                      <div key={item.id} className="rounded-md border border-border p-3 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(item.createdAt as unknown as string).toLocaleString()}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.email}</p>
                        <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const subject = encodeURIComponent("Respuesta a tu mensaje");
                              const body = encodeURIComponent(
                                `Hola ${item.name},\n\nGracias por escribirnos.\n\n`
                              );
                              window.location.href = `mailto:${item.email}?subject=${subject}&body=${body}`;
                            }}
                          >
                            Responder
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aún no hay mensajes.</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="sitio" className="space-y-4">
              <Card className="p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Configuración del sitio</p>
                  <p className="text-xs text-muted-foreground">
                    Nombre del sitio, textos de home/about/contact y links del footer.
                  </p>
                </div>

                {adminSiteSettingsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando configuración del sitio...</p>
                ) : adminSiteSettingsQuery.error ? (
                  <p className="text-sm text-destructive">No se pudo cargar la configuración del sitio</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Nombre del sitio</p>
                      <Input value={siteDraft.siteName} onChange={(e) => updateSiteDraft({ siteName: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Hero subtitle</p>
                      <Input value={siteDraft.heroSubtitle} onChange={(e) => updateSiteDraft({ heroSubtitle: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Hero descripción</p>
                      <Input value={siteDraft.heroDescription} onChange={(e) => updateSiteDraft({ heroDescription: e.target.value })} className="h-8 text-xs" />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">About título</p>
                      <Input value={siteDraft.aboutTitle} onChange={(e) => updateSiteDraft({ aboutTitle: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">About líneas (una por línea)</p>
                      <textarea
                        value={siteDraft.aboutLines.join("\n")}
                        onChange={(e) => updateSiteDraft({ aboutLines: parseLines(e.target.value) })}
                        className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-xs"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Contact título</p>
                      <Input value={siteDraft.contactTitle} onChange={(e) => updateSiteDraft({ contactTitle: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Contact subtítulo</p>
                      <Input value={siteDraft.contactSubtitle} onChange={(e) => updateSiteDraft({ contactSubtitle: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Label nombre</p>
                      <Input value={siteDraft.contactNameLabel} onChange={(e) => updateSiteDraft({ contactNameLabel: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Label email</p>
                      <Input value={siteDraft.contactEmailLabel} onChange={(e) => updateSiteDraft({ contactEmailLabel: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Label mensaje</p>
                      <Input value={siteDraft.contactMessageLabel} onChange={(e) => updateSiteDraft({ contactMessageLabel: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Placeholder nombre</p>
                      <Input value={siteDraft.contactNamePlaceholder} onChange={(e) => updateSiteDraft({ contactNamePlaceholder: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Placeholder email</p>
                      <Input value={siteDraft.contactEmailPlaceholder} onChange={(e) => updateSiteDraft({ contactEmailPlaceholder: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Placeholder mensaje</p>
                      <Input value={siteDraft.contactMessagePlaceholder} onChange={(e) => updateSiteDraft({ contactMessagePlaceholder: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Texto botón enviar</p>
                      <Input value={siteDraft.contactButtonLabel} onChange={(e) => updateSiteDraft({ contactButtonLabel: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Toast éxito título</p>
                      <Input value={siteDraft.contactSuccessTitle} onChange={(e) => updateSiteDraft({ contactSuccessTitle: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Toast éxito descripción</p>
                      <Input value={siteDraft.contactSuccessDescription} onChange={(e) => updateSiteDraft({ contactSuccessDescription: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Destino de mensajes (texto informativo)</p>
                      <Input value={siteDraft.contactDestination} onChange={(e) => updateSiteDraft({ contactDestination: e.target.value })} className="h-8 text-xs" />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Footer GitHub URL</p>
                      <Input value={siteDraft.footerGithubUrl} onChange={(e) => updateSiteDraft({ footerGithubUrl: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Footer Discord URL</p>
                      <Input value={siteDraft.footerDiscordUrl} onChange={(e) => updateSiteDraft({ footerDiscordUrl: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Footer YouTube URL</p>
                      <Input value={siteDraft.footerYoutubeUrl} onChange={(e) => updateSiteDraft({ footerYoutubeUrl: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Footer email</p>
                      <Input value={siteDraft.footerEmail} onChange={(e) => updateSiteDraft({ footerEmail: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Footer copyright</p>
                      <Input value={siteDraft.footerCopyright} onChange={(e) => updateSiteDraft({ footerCopyright: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Footer desarrollado por</p>
                      <Input value={siteDraft.footerDevelopedBy} onChange={(e) => updateSiteDraft({ footerDevelopedBy: e.target.value })} className="h-8 text-xs" />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => saveSiteSettingsMutation.mutate()}
                    disabled={saveSiteSettingsMutation.isPending}
                  >
                    Guardar configuración del sitio
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <Card className="p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Configurar juegos existentes</p>
                  <p className="text-xs text-muted-foreground">
                    Editar, guardar y eliminar juegos actuales.
                  </p>
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
            </TabsContent>

            <TabsContent value="agregar">
              <Card className="p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Agregar juego nuevo</p>
                  <p className="text-xs text-muted-foreground">
                    Crea una nueva entrada de juego en el catálogo.
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
              </Card>
            </TabsContent>

            <TabsContent value="levelshots">
              <Card className="p-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Tabla de levelshots</p>
                  <p className="text-xs text-muted-foreground">
                    Mapa + URL de imagen para completar faltantes o reemplazar levelshots.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={newLevelshotMap}
                    onChange={(event) => setNewLevelshotMap(event.target.value)}
                    placeholder="Mapa (ej: q3ctf4)"
                  />
                  <Input
                    value={newLevelshotUrl}
                    onChange={(event) => {
                      setNewLevelshotUrl(event.target.value);
                      if (newLevelshotFile) {
                        setNewLevelshotFile(null);
                        if (levelshotFileInputRef.current) {
                          levelshotFileInputRef.current.value = "";
                        }
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveLevelshotMutation.mutate();
                      }
                    }}
                    placeholder="URL imagen (/images/q3ctf4.jpg o https://...)"
                  />
                  <Button
                    onClick={() => saveLevelshotMutation.mutate()}
                    disabled={saveLevelshotMutation.isPending}
                  >
                    Guardar levelshot
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fillCurrentMap}
                  >
                    Mapa actual
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyLvlworldTemplate}
                  >
                    Usar URL Lvlworld
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyEfserversTemplate}
                  >
                    Usar URL EFSERVERS
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyQ3dfTemplate}
                  >
                    Usar URL Q3DF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearLevelshotForm}
                  >
                    Limpiar
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Fuentes: lvlworld, efservers y ws.q3df.org
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={levelshotFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setNewLevelshotFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => levelshotFileInputRef.current?.click()}
                  >
                    Buscar imagen
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {newLevelshotFile
                      ? `Archivo seleccionado: ${newLevelshotFile.name}`
                      : "Sin archivo seleccionado (podés usar URL manual)."}
                  </p>
                </div>

                {activeLevelshotPreviewUrl && !newLevelshotPreviewFailed && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Preview antes de guardar</p>
                    <img
                      src={activeLevelshotPreviewUrl}
                      alt="Preview levelshot"
                      className="h-36 w-64 rounded border border-border object-cover"
                      onError={() => setNewLevelshotPreviewFailed(true)}
                    />
                  </div>
                )}

                {newLevelshotPreviewFailed && (
                  <p className="text-xs text-destructive">
                    No se pudo cargar la preview con la imagen actual.
                  </p>
                )}

                {currentMapNeedsSuggestion && (
                  <Card className="p-3 space-y-2">
                    <p className="text-sm font-semibold">Sugerencia automática (partida actual)</p>
                    <p className="text-xs text-muted-foreground">
                      Mapa actual: {currentMapName} - sin override guardado aún.
                    </p>
                    <img
                      src={
                        currentMapSuggestionSource === "lvlworld"
                          ? getLvlworldUrlForMap(currentMapName)
                          : getEfserversUrlForMap(currentMapName)
                      }
                      alt={`Sugerencia ${currentMapName}`}
                      className="h-36 w-64 rounded border border-border object-cover"
                      onError={() => {
                        if (currentMapSuggestionSource === "lvlworld") {
                          setCurrentMapSuggestionSource("efservers");
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Recursos alternativos: {" "}
                      <a href={getEfserversUrlForMap(currentMapName)} target="_blank" rel="noreferrer" className="underline">
                        abrir EFSERVERS
                      </a>
                      {" - "}
                      <a href={getQ3dfUrlForMap(currentMapName)} target="_blank" rel="noreferrer" className="underline">
                        abrir Q3DF
                      </a>
                      {" "}(puede bloquear preview por Cloudflare 403).
                    </p>
                    <div>
                      <Button
                        size="sm"
                        onClick={() =>
                          saveSuggestedLevelshotMutation.mutate({
                            mapName: currentMapName,
                            imageUrl:
                              currentMapSuggestionSource === "lvlworld"
                                ? getLvlworldUrlForMap(currentMapName)
                                : getEfserversUrlForMap(currentMapName),
                          })
                        }
                        disabled={saveSuggestedLevelshotMutation.isPending}
                      >
                        Guardar sugerencia actual
                      </Button>
                    </div>
                  </Card>
                )}

                <Card className="p-3 space-y-3">
                  <p className="text-sm font-semibold">Sugerencias de mapas sin override</p>
                  {recentMatchesQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Buscando mapas recientes...</p>
                  ) : recentMatchesQuery.error ? (
                    <p className="text-xs text-destructive">No se pudieron cargar sugerencias de mapas</p>
                  ) : suggestedLevelshots.length ? (
                    <div className="space-y-2">
                      {suggestedLevelshots.map((item) => (
                        <div key={item.mapName} className="rounded border border-border p-2 flex flex-wrap items-center gap-3">
                          <img
                            src={
                              (suggestionSourceByMap[item.mapName] || "lvlworld") === "lvlworld"
                                ? item.lvlworldUrl
                                : item.efserversUrl
                            }
                            alt={`Sugerencia ${item.mapName}`}
                            className="h-16 w-28 rounded border border-border object-cover"
                            onError={() => {
                              setSuggestionSourceByMap((current) => {
                                if ((current[item.mapName] || "lvlworld") === "efservers") {
                                  return current;
                                }
                                return {
                                  ...current,
                                  [item.mapName]: "efservers",
                                };
                              });
                            }}
                          />
                          <div className="min-w-40">
                            <p className="text-sm font-medium">{item.mapName}</p>
                            <p className="text-xs text-muted-foreground break-all">
                              {(suggestionSourceByMap[item.mapName] || "lvlworld") === "lvlworld"
                                ? item.lvlworldUrl
                                : item.efserversUrl}
                            </p>
                            <a
                              href={item.efserversUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline text-muted-foreground"
                            >
                              Abrir EFSERVERS alternativo
                            </a>
                            <span className="text-xs text-muted-foreground"> {" · "}</span>
                            <a
                              href={item.q3dfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline text-muted-foreground"
                            >
                              Abrir Q3DF alternativo
                            </a>
                          </div>
                          <div className="ml-auto flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNewLevelshotMap(item.mapName);
                                setNewLevelshotUrl(
                                  (suggestionSourceByMap[item.mapName] || "lvlworld") === "lvlworld"
                                    ? item.lvlworldUrl
                                    : item.efserversUrl,
                                );
                                setNewLevelshotFile(null);
                                if (levelshotFileInputRef.current) {
                                  levelshotFileInputRef.current.value = "";
                                }
                              }}
                            >
                              Cargar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                saveSuggestedLevelshotMutation.mutate({
                                  mapName: item.mapName,
                                  imageUrl:
                                    (suggestionSourceByMap[item.mapName] || "lvlworld") === "lvlworld"
                                      ? item.lvlworldUrl
                                      : item.efserversUrl,
                                })
                              }
                              disabled={saveSuggestedLevelshotMutation.isPending}
                            >
                              Guardar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No hay sugerencias pendientes.</p>
                  )}
                </Card>

                {adminLevelshotsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando tabla de levelshots...</p>
                ) : adminLevelshotsQuery.error ? (
                  <p className="text-sm text-destructive">
                    {adminLevelshotsQuery.error instanceof Error
                      ? adminLevelshotsQuery.error.message
                      : "No se pudo cargar la tabla de levelshots"}
                  </p>
                ) : adminLevelshotsQuery.data?.levelshots?.length ? (
                  <div className="space-y-2">
                    {adminLevelshotsQuery.data.levelshots.map((item) => (
                      <div key={item.mapName} className="rounded-md border border-border p-3">
                        <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr_auto] gap-3 items-center">
                          <img
                            src={item.imageUrl}
                            alt={`Levelshot ${item.mapName}`}
                            className="h-20 w-36 rounded border border-border object-cover"
                          />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{item.mapName}</p>
                            <p className="text-xs text-muted-foreground break-all">{item.imageUrl}</p>
                            <p className="text-xs text-muted-foreground">Actualizado: {new Date(item.updatedAt).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewLevelshotMap(item.mapName);
                                setNewLevelshotUrl(item.imageUrl);
                                setNewLevelshotFile(null);
                                if (levelshotFileInputRef.current) {
                                  levelshotFileInputRef.current.value = "";
                                }
                                setActiveSection("levelshots");
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                const confirmDelete = window.confirm(`¿Eliminar override de ${item.mapName}?`);
                                if (confirmDelete) {
                                  deleteLevelshotMutation.mutate(item.mapName);
                                }
                              }}
                              disabled={deleteLevelshotMutation.isPending}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay overrides cargados.</p>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
