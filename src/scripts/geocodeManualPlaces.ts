import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve("data", "candidates");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address
  )}&format=json&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MOSAIC-Recreation-App/1.0 (scoot@example.com)",
      },
    });

    if (!res.ok) {
      console.warn(`[Geocode] HTTP error for ${address}: ${res.status}`);
      return null;
    }

    const data = await res.json() as any[];
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.error(`[Geocode Error] ${err}`);
  }

  return null;
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? findJsonFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files).filter((f) => f.endsWith(".json"));
}

async function main() {
  const files = await findJsonFiles(DATA_DIR);
  let totalFixed = 0;

  for (const file of files) {
    let changed = false;
    const content = await fs.readFile(file, "utf8");
    const data = JSON.parse(content);

    if (!data.places || !Array.isArray(data.places)) continue;

    for (let i = 0; i < data.places.length; i++) {
        const place = data.places[i];
        if (place.source && place.source.sourceType === "manual" && place.address) {
            console.log(`Geocoding: ${place.name} -> ${place.address}`);
            
            await sleep(1200); // 1.2s delay to respect Nominatim limits
            
            const result = await geocode(place.address);
            if (result) {
                console.log(`  -> Found: ${result.lat}, ${result.lon}`);
                place.location = { lat: result.lat, lng: result.lon };
                place.googleMapsUrl = `https://maps.google.com/?q=${result.lat},${result.lon}`;
                place.updatedAt = new Date().toISOString();
                changed = true;
                totalFixed++;
            } else {
                console.log(`  -> Not found for address: ${place.address}`);
            }
        }
    }

    if (changed) {
        await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    }
  }

  console.log(`\nFinished updating coordinates for ${totalFixed} places.`);
}

main().catch(console.error);
