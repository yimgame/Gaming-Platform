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
















