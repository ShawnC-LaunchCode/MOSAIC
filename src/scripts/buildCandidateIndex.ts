import fs from "fs/promises";
import path from "path";
import type { CandidatePlace, CandidateIndex } from "../types/core.js";

const DATA_DIR = path.resolve("data/candidates");
const OUT_FILE = path.resolve("build/candidate-index.json");

async function findJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findJsonFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }

  return files;
}

async function main() {
  console.log("Building candidate index...");

  const jsonFiles = await findJsonFiles(DATA_DIR);
  console.log(`Found ${jsonFiles.length} file(s) under data/candidates`);

  const allPlaces: CandidatePlace[] = [];
  let skipped = 0;

  for (const file of jsonFiles) {
    const raw = await fs.readFile(file, "utf-8");
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`  [skip] Could not parse JSON: ${file}`);
      skipped++;
      continue;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).places)
    ) {
      console.warn(`  [skip] Missing or invalid 'places' array: ${file}`);
      skipped++;
      continue;
    }

    const dataset = parsed as { places: unknown[] };
    const validPlaces: CandidatePlace[] = [];

    for (const place of dataset.places) {
      if (
        typeof place !== "object" ||
        place === null ||
        typeof (place as Record<string, unknown>).id !== "string" ||
        typeof (place as Record<string, unknown>).name !== "string"
      ) {
        console.warn(`  [skip place] Missing id or name in ${file}`);
        continue;
      }
      validPlaces.push(place as CandidatePlace);
    }

    console.log(`  ${path.relative(".", file)}: ${validPlaces.length} place(s)`);
    allPlaces.push(...validPlaces);
  }

  const index: CandidateIndex = {
    generatedAt: new Date().toISOString(),
    places: Object.fromEntries(allPlaces.map((p) => [p.id, p])),
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(index, null, 2), "utf-8");

  console.log(`\nDone.`);
  console.log(`  Total places: ${allPlaces.length}`);
  console.log(`  Files skipped: ${skipped}`);
  console.log(`  Output: ${path.relative(".", OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Error building candidate index:", err);
  process.exit(1);
});
