import fs from "node:fs";

type ResolvedDatabaseUrl = {
  url: string;
  usedHostFallback: boolean;
};

const isRunningInsideContainer = () => {
  if (process.env.RUNNING_IN_DOCKER === "1") return true;
  if (process.env.CONTAINER === "1") return true;
  return fs.existsSync("/.dockerenv");
};

export function resolveDatabaseUrl(rawUrl: string | undefined): ResolvedDatabaseUrl {
  if (!rawUrl) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  try {
    const parsed = new URL(rawUrl);
    const shouldUseHostFallback = parsed.hostname === "db" && !isRunningInsideContainer();

    if (!shouldUseHostFallback) {
      return {
        url: rawUrl,
        usedHostFallback: false,
      };
    }

    const fallbackPort = process.env.DB_PORT || (parsed.port === "5432" || !parsed.port ? "5433" : parsed.port);
    parsed.hostname = "localhost";
    parsed.port = fallbackPort;

    return {
      url: parsed.toString(),
      usedHostFallback: true,
    };
  } catch {
    return {
      url: rawUrl,
      usedHostFallback: false,
    };
  }
}
