import fs from "fs/promises";
import path from "path";
import { getDistance } from "geolib";

const CANDIDATES_DIR = path.resolve("data", "candidates");
const RESTRICTED_INDEX = path.resolve("build", "restricted-index.json");

async function findJsonFiles(dir: string): Promise<string[]> {
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? findJsonFiles(res) : res;
      })
    );
    return Array.prototype.concat(...files).filter((f) => f.endsWith(".json"));
  } catch (e) {
    return [];
  }
}

async function main() {
  // Load restricted sites to find all playgrounds
  const restrictedContent = await fs.readFile(RESTRICTED_INDEX, "utf8");
  const restrictedData = JSON.parse(restrictedContent);
  const playgrounds = Object.values(restrictedData.sites).filter(
    (s: any) => s.restrictedPropertyType === "park-with-playground" && s.location && s.location.lat !== null
  ) as any[];

  console.log(`Found ${playgrounds.length} playgrounds in restricted index.`);

  const candidateFiles = await findJsonFiles(CANDIDATES_DIR);
  let totalTagsAdded = 0;

  for (const file of candidateFiles) {
    let changed = false;
    const content = await fs.readFile(file, "utf8");
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      continue;
    }

    if (data.places && Array.isArray(data.places)) {
      for (const place of data.places) {
        if (!place.location || place.location.lat === null) continue;

        // Check if overlaps (is within 500ft of) any playground
        // 500ft is ~152 meters. Using a slightly more generous 250 meters to cover large parks if the pin is off-center.
        let hasOverlap = false;

        for (const pg of playgrounds) {
          const dist = getDistance(
            { latitude: place.location.lat, longitude: place.location.lng },
            { latitude: pg.location.lat, longitude: pg.location.lng }
          );

          if (dist <= 250 || (place.name && pg.name.includes(place.name))) {
            hasOverlap = true;
            break;
          }
        }

        if (hasOverlap) {
          if (!place.tags) place.tags = [];
          if (!place.tags.includes("playground")) {
            place.tags.push("playground");
            changed = true;
            totalTagsAdded++;
          }
        }
      }
    }

    if (changed) {
      await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    }
  }

  console.log(`\nSuccessfully added 'playground' tag to ${totalTagsAdded} candidate locations.`);
}

main().catch(console.error);
