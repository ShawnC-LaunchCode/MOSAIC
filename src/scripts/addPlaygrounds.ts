import fs from "fs/promises";
import path from "path";

const EXISTING_FILE = path.resolve("data", "restricted", "parks-with-playgrounds", "st-charles-county.json");

const PLACES = [
  { name: "Broemmelsiek Park", address: "1795 Highway DD, Defiance, MO 63341" },
  { name: "Indian Camp Creek Park", address: "2679 Dietrich Rd, Foristell, MO 63348" },
  { name: "Kinetic Park", address: "7801 Town Square Ave, Dardenne Prairie, MO 63368" },
  { name: "Klondike Park", address: "4600 Highway 94 S, Augusta, MO 63332" },
  { name: "Oglesby Park", address: "2801 West Meyer Rd, Foristell, MO 63348" },
  { name: "Riverside Landing Park", address: "101 Riverport Lane, St. Charles, MO 63301" },
  { name: "Quail Ridge Park", address: "560 Interstate Dr, Wentzville, MO 63385" },
  { name: "Towne Park", address: "100 Towne Park Dr, Foristell, MO 63348" },
  { name: "Veterans Tribute Park", address: "101 Kisker Rd, St. Charles, MO 63304" },
];

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MOSAIC-Recreation-App-Playgrounds/1.0" } });
    if (!res.ok) return null;
    const data = await res.json() as any[];
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {}
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  let existingData: any = { sites: [] };
  try {
    const content = await fs.readFile(EXISTING_FILE, "utf8");
    existingData = JSON.parse(content);
  } catch (e) {
    existingData = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      county: "st-charles-county",
      sourceKind: "parks-with-playgrounds",
      sites: []
    };
  }

  if (!existingData.sites) existingData.sites = [];

  let added = 0;

  for (const p of PLACES) {
    // Check if we already have it
    const exists = existingData.sites.find((s: any) => s.name.includes(p.name));
    if (exists) {
      console.log(`Skipping ${p.name}, already restricted.`);
      continue;
    }

    console.log(`Geocoding: ${p.name}...`);
    await sleep(1500); // Respect nominatim rate limit

    let location = await geocode(p.address);
    if (!location) {
        // Just use the name if address fails
        location = await geocode(`${p.name}, St. Charles County, MO`);
        await sleep(1500);
    }

    let lat = location?.lat || null;
    let lon = location?.lon || null;

    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newId = `restricted:park-with-playground:st-charles-county:${slug}`;
    
    // In St Charles County
    const site = {
      id: newId,
      name: `${p.name} - Playground Area`,
      county: "st-charles-county",
      municipality: p.address.split(", ")[1] || "St. Charles County",
      restrictedPropertyType: "park-with-playground",
      address: p.address,
      location: { lat, lng: lon },
      source: {
        id: `source-playground-${slug}`,
        sourceType: "manual",
        sourceName: "St Charles Parks Table",
        fetchedAt: new Date().toISOString()
      },
      needsVerification: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    existingData.sites.push(site);
    added++;
    console.log(`  -> Added ${p.name}.`);
  }

  if (added > 0) {
    await fs.mkdir(path.dirname(EXISTING_FILE), { recursive: true });
    await fs.writeFile(EXISTING_FILE, JSON.stringify(existingData, null, 2), "utf8");
    console.log(`\nSuccessfully added ${added} playgrounds to the restricted list.`);
  } else {
    console.log(`\nNo new playgrounds were added.`);
  }
}

main().catch(console.error);
