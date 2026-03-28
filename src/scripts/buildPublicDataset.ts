import fs from "fs/promises";
import path from "path";
import type { ClassifiedPlacesDataset, PlaceRecord } from "../types/core.js";
import type { PublicPlaceRecord, PublicPlacesDataset } from "../types/public.js";

// ─── Paths ────────────────────────────────────────────────────────────────────

const CLASSIFIED_FILE = path.resolve("build/classified-places.json");
const OUT_FILE        = path.resolve("public/places.json");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReviewedLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Separate reasons from warnings.
 * Reasons that read like advisories (containing "may", "always", "verify") are
 * surfaced as warnings so the frontend can display them prominently.
 */
function splitReasonsAndWarnings(reasons: string[]): {
  reasons: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const filtered: string[] = [];

  for (const r of reasons) {
    if (/\b(may|always|verify|additional restrictions)\b/i.test(r)) {
      warnings.push(r);
    } else {
      filtered.push(r);
    }
  }

  return { reasons: filtered, warnings };
}

function buildGoogleMapsUrl(lat: number, lng: number, name: string): string {
  const query = encodeURIComponent(`${name} ${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function buildTags(record: PlaceRecord): string[] {
  return [
    record.place.recreationType,
    record.place.county,
    record.finalClassification,
  ];
}

function toPublicRecord(record: PlaceRecord): PublicPlaceRecord {
  const { place, autoResult, finalClassification, reviewStatus, updatedAt } = record;
  const { summary, reasons: allReasons } = autoResult.explanation;
  const { reasons, warnings } = splitReasonsAndWarnings(allReasons);

  return {
    id: place.id,
    name: place.name,
    county: place.county,
    municipality: place.municipality,
    recreationType: place.recreationType,
    location: place.location,
    googleMapsUrl: place.googleMapsUrl ?? buildGoogleMapsUrl(place.location.lat, place.location.lng, place.name),
    websiteUrl: place.websiteUrl,
    finalClassification,
    summary,
    reasons,
    warnings,
    tags: buildTags(record),
    lastReviewedLabel: formatReviewedLabel(updatedAt),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Building public dataset...\n");

  const raw = await fs.readFile(CLASSIFIED_FILE, "utf-8");
  const classified = JSON.parse(raw) as ClassifiedPlacesDataset;

  const eligible = classified.records.filter(
    (r) => r.finalClassification === "candidate" || r.finalClassification === "needs-review"
  );

  console.log(`  Total classified records: ${classified.records.length}`);
  console.log(`  Eligible for public:      ${eligible.length}`);
  console.log(`    (excluded: ${classified.records.length - eligible.length})`);

  const places: PublicPlaceRecord[] = eligible.map(toPublicRecord);

  const dataset: PublicPlacesDataset = {
    version: classified.version,
    generatedAt: new Date().toISOString(),
    places,
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(dataset, null, 2), "utf-8");

  console.log(`\nDone.`);
  console.log(`  Public places written: ${places.length}`);
  console.log(`  Output: ${path.relative(".", OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Error building public dataset:", err);
  process.exit(1);
});
