import fs from "fs/promises";
import path from "path";

const DATA_DIRS = [
  path.resolve("data", "candidates"),
  path.resolve("data", "restricted"),
];

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
  let totalFixed = 0;

  for (const DATA_DIR of DATA_DIRS) {
    const files = await findJsonFiles(DATA_DIR);
    for (const file of files) {
      let changed = false;
      const content = await fs.readFile(file, "utf8");
      let data;
      try {
        data = JSON.parse(content);
      } catch (e) {
        continue;
      }

      if (data.places && Array.isArray(data.places)) {
        for (let i = 0; i < data.places.length; i++) {
          const place = data.places[i];
          const query = encodeURIComponent(`${place.name}, ${place.address || place.county || place.municipality || ""}`.trim());
          const betterUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
          
          if (place.googleMapsUrl !== betterUrl) {
            place.googleMapsUrl = betterUrl;
            changed = true;
            totalFixed++;
          }
        }
      }

      if (changed) {
        await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
      }
    }
  }

  console.log(`\nReplaced Google Maps URLs for ${totalFixed} places format.`);
}

main().catch(console.error);
