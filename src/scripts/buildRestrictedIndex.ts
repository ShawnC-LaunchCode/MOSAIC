import fs from "fs/promises";
import path from "path";
import type { RestrictedSite, RestrictedIndex } from "../types/core.js";

const DATA_DIR = path.resolve("data/restricted");
const OUT_FILE = path.resolve("build/restricted-index.json");

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
  console.log("Building restricted index...");

  const jsonFiles = await findJsonFiles(DATA_DIR);
  console.log(`Found ${jsonFiles.length} file(s) under data/restricted`);

  const allSites: RestrictedSite[] = [];
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
      !Array.isArray((parsed as Record<string, unknown>).sites)
    ) {
      console.warn(`  [skip] Missing or invalid 'sites' array: ${file}`);
      skipped++;
      continue;
    }

    const dataset = parsed as { sites: unknown[] };
    const validSites: RestrictedSite[] = [];

    for (const site of dataset.sites) {
      if (
        typeof site !== "object" ||
        site === null ||
        typeof (site as Record<string, unknown>).id !== "string" ||
        typeof (site as Record<string, unknown>).name !== "string"
      ) {
        console.warn(`  [skip site] Missing id or name in ${file}`);
        continue;
      }
      validSites.push(site as RestrictedSite);
    }

    console.log(`  ${path.relative(".", file)}: ${validSites.length} site(s)`);
    allSites.push(...validSites);
  }

  const index: RestrictedIndex = {
    generatedAt: new Date().toISOString(),
    sites: Object.fromEntries(allSites.map((s) => [s.id, s])),
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(index, null, 2), "utf-8");

  console.log(`\nDone.`);
  console.log(`  Total sites: ${allSites.length}`);
  console.log(`  Files skipped: ${skipped}`);
  console.log(`  Output: ${path.relative(".", OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Error building restricted index:", err);
  process.exit(1);
});
