import fs from "fs/promises";
import path from "path";
import { getDistance } from "geolib";
import type {
  RestrictedIndex,
  CandidateIndex,
  ManualReviewDataset,
  ManualReview,
  CandidatePlace,
  RestrictedSite,
  DistanceCheck,
  PlaceRecord,
  ReviewStatus,
  ClassifiedPlacesDataset,
} from "../types/core.js";
import { buildRestrictionFlags } from "../rules/distanceChecks.js";
import { classifyPlace } from "../rules/classifyPlace.js";
import { resolveFinalClassification } from "../rules/resolveFinalClassification.js";

// ─── Paths ────────────────────────────────────────────────────────────────────

const RESTRICTED_INDEX = path.resolve("build/restricted-index.json");
const CANDIDATE_INDEX  = path.resolve("build/candidate-index.json");
const MANUAL_REVIEWS   = path.resolve("data/manual-reviews.json");
const BUILD_DIR        = path.resolve("build");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RULES_VERSION = "1.0.0";

function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

/** Compute a core DistanceCheck for every restricted site against a candidate place. */
function computeDistanceChecks(
  place: CandidatePlace,
  sites: RestrictedSite[]
): DistanceCheck[] {
  return sites.flatMap((site) => {
    if (site.location.lat === null || site.location.lng === null) return [];
    const meters = getDistance(
      { latitude: place.location.lat, longitude: place.location.lng },
      { latitude: site.location.lat, longitude: site.location.lng }
    );
    const distanceFt = metersToFeet(meters);
    
    // Only persist distance checks that are realistically nearby to save massive JSON file space.
    if (distanceFt > 1000) return [];
    
    return [{
      restrictedSiteId: site.id,
      restrictedSiteType: site.restrictedPropertyType,
      distanceFt,
      withinThreshold: distanceFt <= 500,
    }];
  });
}

function formatReviewedLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

interface DisplayValues {
  title: string;
  subtitle: string;
  badges: string[];
  lastReviewedLabel: string;
}

function buildDisplay(record: PlaceRecord): DisplayValues {
  const { place, finalClassification, reviewStatus, updatedAt } = record;

  const badges: string[] = [
    finalClassification,
    place.recreationType,
    place.county,
  ];

  if (record.manualReview) {
    badges.push("manually-reviewed");
  }

  const countyLabel =
    place.county === "st-louis-county" ? "St. Louis County" : "St. Charles County";

  return {
    title: place.name,
    subtitle: `${countyLabel} · ${place.recreationType}`,
    badges,
    lastReviewedLabel: formatReviewedLabel(updatedAt),
  };
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

// ─── Write ────────────────────────────────────────────────────────────────────

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Classifying places...\n");

  // Load inputs
  const restrictedIndex = await loadJson<RestrictedIndex>(RESTRICTED_INDEX);
  const candidateIndex  = await loadJson<CandidateIndex>(CANDIDATE_INDEX);
  const manualDataset   = await loadJson<ManualReviewDataset>(MANUAL_REVIEWS);

  const restrictedSites = Object.values(restrictedIndex.sites);
  const candidatePlaces = Object.values(candidateIndex.places);

  // Build manual review lookup
  const manualReviewMap = new Map<string, ManualReview>(
    manualDataset.reviews.map((r) => [r.placeId, r])
  );

  console.log(`  Restricted sites:  ${restrictedSites.length}`);
  console.log(`  Candidate places:  ${candidatePlaces.length}`);
  console.log(`  Manual reviews:    ${manualDataset.reviews.length}\n`);

  const records: PlaceRecord[] = [];

  for (const place of candidatePlaces) {
    const flags          = buildRestrictionFlags(place, restrictedSites);
    const distanceChecks = computeDistanceChecks(place, restrictedSites);
    const autoResult     = classifyPlace(place, flags, { rulesVersion: RULES_VERSION, distanceChecks });
    const manualReview   = manualReviewMap.get(place.id);

    const finalClassification = resolveFinalClassification(autoResult, manualReview);

    const reviewStatus: ReviewStatus = manualReview
      ? "manually-reviewed"
      : "auto-reviewed";

    const record: PlaceRecord = {
      place,
      autoResult,
      ...(manualReview ? { manualReview } : {}),
      finalClassification,
      reviewStatus,
      updatedAt: new Date().toISOString(),
    };

    records.push(record);
  }

  // Attach display values and write split outputs
  const withDisplay = records.map((r) => ({ ...r, display: buildDisplay(r) }));

  const candidates = withDisplay.filter((r) => r.finalClassification === "candidate");
  const needsReview = withDisplay.filter((r) => r.finalClassification === "needs-review");
  const excluded = withDisplay.filter((r) => r.finalClassification === "likely-excluded");

  const generatedAt = new Date().toISOString();

  const allDataset: ClassifiedPlacesDataset = {
    version: RULES_VERSION,
    generatedAt,
    records,
  };

  await Promise.all([
    writeJson(path.join(BUILD_DIR, "classified-places.json"), allDataset),
    writeJson(path.join(BUILD_DIR, "candidate-places.json"),  { version: RULES_VERSION, generatedAt, records: candidates }),
    writeJson(path.join(BUILD_DIR, "review-places.json"),     { version: RULES_VERSION, generatedAt, records: needsReview }),
    writeJson(path.join(BUILD_DIR, "excluded-places.json"),   { version: RULES_VERSION, generatedAt, records: excluded }),
  ]);

  console.log("Classification complete:");
  console.log(`  candidate:        ${candidates.length}`);
  console.log(`  needs-review:     ${needsReview.length}`);
  console.log(`  likely-excluded:  ${excluded.length}`);
  console.log(`  total:            ${records.length}`);
  console.log(`\nOutput written to build/`);
}

main().catch((err) => {
  console.error("Error classifying places:", err);
  process.exit(1);
});
