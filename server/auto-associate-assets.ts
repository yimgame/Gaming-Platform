import "dotenv/config";
import { getAllMatches } from "./stats-parser";
import { getScreenshotsByMatch } from "./screenshots-service";
import { getDemosByMatch } from "./demos-service";
import {
  createManualMatchAssetIfMissing,
  getManualMatchAssets,
} from "./match-assets-service";

interface AutoAssociateSummary {
  matchesProcessed: number;
  screenshotsCreated: number;
  demosCreated: number;
  skippedExisting: number;
}

async function autoAssociateAssets(): Promise<AutoAssociateSummary> {
  const matches = await getAllMatches();

  let screenshotsCreated = 0;
  let demosCreated = 0;
  let skippedExisting = 0;

  for (const match of matches) {
    const existingAssets = await getManualMatchAssets(match.id);

    const existingScreenshotNames = new Set(
      existingAssets
        .filter((item) => item.kind === "screenshot")
        .map((item) => item.filename.toLowerCase()),
    );

    const existingDemoNames = new Set(
      existingAssets
        .filter((item) => item.kind === "demo")
        .map((item) => item.filename.toLowerCase()),
    );

    const screenshotCandidates = await getScreenshotsByMatch(
      match.type,
      match.map,
      match.datetime,
      4,
      Array.from(existingScreenshotNames),
    );

    if (screenshotCandidates.length > 0) {
      const firstScreenshot = screenshotCandidates[0];
      const screenshotKey = firstScreenshot.filename.toLowerCase();
      if (existingScreenshotNames.has(screenshotKey)) {
        skippedExisting += 1;
      } else {
        const inserted = await createManualMatchAssetIfMissing({
          matchId: match.id,
          kind: "screenshot",
          filename: firstScreenshot.filename,
          sourcePath: firstScreenshot.path,
        });

        if (inserted) {
          screenshotsCreated += 1;
        } else {
          skippedExisting += 1;
        }
      }
    }

    const demoCandidates = await getDemosByMatch(
      match.type,
      match.map,
      match.datetime,
      4,
      Array.from(existingDemoNames),
    );

    if (demoCandidates.length > 0) {
      const firstDemo = demoCandidates[0];
      const demoKey = firstDemo.filename.toLowerCase();
      if (existingDemoNames.has(demoKey)) {
        skippedExisting += 1;
      } else {
        const inserted = await createManualMatchAssetIfMissing({
          matchId: match.id,
          kind: "demo",
          filename: firstDemo.filename,
          sourcePath: firstDemo.path,
        });

        if (inserted) {
          demosCreated += 1;
        } else {
          skippedExisting += 1;
        }
      }
    }
  }

  return {
    matchesProcessed: matches.length,
    screenshotsCreated,
    demosCreated,
    skippedExisting,
  };
}

async function run() {
  try {
    const summary = await autoAssociateAssets();
    console.log("Auto-association completed:");
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Auto-association failed:", error);
    process.exit(1);
  }
}

run();
