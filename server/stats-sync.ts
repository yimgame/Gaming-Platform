import "dotenv/config";
import { getAllMatches } from "./stats-parser";
import { isMissingStatsTablesError, syncMatchesToStatsDb } from "./match-stats-db-service";

async function run() {
  try {
    const matches = await getAllMatches();
    const summary = await syncMatchesToStatsDb(matches);
    console.log("Stats sync completed:");
    console.log(JSON.stringify({ imported: summary.imported }, null, 2));
    process.exit(0);
  } catch (error) {
    if (isMissingStatsTablesError(error)) {
      console.error("Stats tables are missing. Run: npm run db:push");
      process.exit(2);
    }

    console.error("Stats sync failed:", error);
    process.exit(1);
  }
}

run();
