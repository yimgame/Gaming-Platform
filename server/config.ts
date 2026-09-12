import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const DEFAULT_QUAKE1_BASE_PATH = "G:\\Games\\Quake\\id1";
const DEFAULT_QUAKE2_BASE_PATH = "G:\\Games\\Quake2\\baseq2";
const DEFAULT_COUNTER16_BASE_PATH = "G:\\Games\\Counter-Strike 1.6\\cstrike";
const DEFAULT_CS2_BASE_PATH = "G:\\Games\\cs2\\cs2";
const DEFAULT_MINECRAFT_BASE_PATH = "G:\\Games\\Minecraft";
const DEFAULT_QUAKE3_BASE_PATH = "G:\\Games\\Quake3\\baseq3";
const DEFAULT_QUAKE3_MOD_PATH = "G:\\Games\\Quake3\\cpma";

export const QUAKE1_BASE_PATH = process.env.QUAKE1_BASE_PATH || DEFAULT_QUAKE1_BASE_PATH;
export const QUAKE2_BASE_PATH = process.env.QUAKE2_BASE_PATH || DEFAULT_QUAKE2_BASE_PATH;
export const QUAKE3_BASE_PATH = process.env.QUAKE3_BASE_PATH || DEFAULT_QUAKE3_BASE_PATH;
export const QUAKE3_MOD_PATH = process.env.QUAKE3_MOD_PATH || path.join(path.dirname(QUAKE3_BASE_PATH), "cpma");
export const QUAKE_BASE_PATH = process.env.QUAKE_BASE_PATH || process.env.QUAKE3_MOD_PATH || DEFAULT_QUAKE3_MOD_PATH;

export const COUNTER16_BASE_PATH = process.env.COUNTER16_BASE_PATH || DEFAULT_COUNTER16_BASE_PATH;
export const CS2_BASE_PATH = process.env.CS2_BASE_PATH || DEFAULT_CS2_BASE_PATH;
export const MINECRAFT_BASE_PATH = process.env.MINECRAFT_BASE_PATH || DEFAULT_MINECRAFT_BASE_PATH;

const pickExistingPath = (candidates: Array<string | undefined>, fallbackPath: string) => {
	for (const candidate of candidates) {
		if (!candidate) continue;
		if (fs.existsSync(candidate)) return candidate;
	}
	return fallbackPath;
};

export const STATS_BASE_PATH = pickExistingPath(
	[
		process.env.STATS_PATH,
		path.join(QUAKE_BASE_PATH, "stats"),
		path.join(QUAKE3_MOD_PATH, "stats"),
		path.join(QUAKE3_BASE_PATH, "cpma", "stats"),
	],
	path.join(QUAKE3_MOD_PATH, "stats")
);

export const SCREENSHOTS_BASE_PATH = pickExistingPath(
	[
		process.env.SCREENSHOTS_PATH,
		path.join(QUAKE_BASE_PATH, "screenshots"),
		path.join(QUAKE3_MOD_PATH, "screenshots"),
		path.join(QUAKE3_BASE_PATH, "cpma", "screenshots"),
	],
	path.join(QUAKE3_MOD_PATH, "screenshots")
);

export const DEMOS_BASE_PATH = pickExistingPath(
	[
		process.env.DEMOS_PATH,
		path.join(QUAKE_BASE_PATH, "demos"),
		path.join(QUAKE3_MOD_PATH, "demos"),
		path.join(QUAKE3_BASE_PATH, "cpma", "demos"),
	],
	path.join(QUAKE3_MOD_PATH, "demos")
);

// Cada server Quake3 fijo (srv_ffa, srv_tdm, srv_ctf, srv_1v1, srv_2v2, srv_ca)
// y cada instancia on-demand del launcher (launcher_*) tiene su propio
// fs_homepath aislado en Quake3/instances/<carpeta>/cpma/stats -- desde que
// se separaron los homepaths para que no compartan config/estado, las
// partidas nuevas dejaron de caer en el STATS_BASE_PATH compartido de
// arriba. Acá los detectamos automáticamente para no tener que hardcodear
// cada carpeta ni tocar esto de nuevo si se agrega un modo más.
export interface StatsSource {
	tag: string;
	path: string;
}

const discoverInstanceStatsSources = (): StatsSource[] => {
	// STATS_BASE_PATH suele resolver a ".../Quake3/cpma/stats"; su abuelo
	// (".../Quake3") es donde vive la carpeta "instances".
	const quake3Root = path.dirname(path.dirname(STATS_BASE_PATH));
	const instancesDir = path.join(quake3Root, "instances");

	const found: StatsSource[] = [];
	try {
		const entries = fs.readdirSync(instancesDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const statsPath = path.join(instancesDir, entry.name, "cpma", "stats");
			if (fs.existsSync(statsPath)) {
				found.push({ tag: entry.name, path: statsPath });
			}
		}
	} catch {
		// La carpeta instances puede no existir todavía (ej. en dev/Windows) -- no pasa nada.
	}
	return found;
};

// Fuentes de stats a recorrer: la carpeta compartida histórica ("legacy",
// partidas de antes de aislar los homepaths) + una por cada instancia
// detectada. syncMatchesToStatsDb hace upsert por matchId así que repetir
// esta lista en cada boot es seguro.
export const STATS_SOURCES: StatsSource[] = [
	{ tag: "legacy", path: STATS_BASE_PATH },
	...discoverInstanceStatsSources(),
];
