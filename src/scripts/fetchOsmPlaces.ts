import fs from "fs/promises";
import path from "path";
import { getDistance } from "geolib";
import crypto from "crypto";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface OsmNode {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
}

interface OsmResponse {
  elements: OsmNode[];
}

interface ExistingPlace {
  id: string;
  name: string;
  location: { lat: number; lng: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DATA_DIR = path.resolve("data");

const COUNTIES = ["st-louis-county", "st-charles-county"] as const;

// We will map OSM tags to our recreation/restricted types.
const TYPE_MAPPINGS = [
  // Restricted Sites Map
  { kind: "restricted", osmKey: "amenity", osmValue: "school", internalCategory: "schools" },
  { kind: "restricted", osmKey: "amenity", osmValue: "childcare", internalCategory: "childcare" },
  { kind: "restricted", osmKey: "amenity", osmValue: "kindergarten", internalCategory: "childcare" },

  // Candidate Sites Map
  { kind: "candidate", osmKey: "leisure", osmValue: "park", internalCategory: "parks", recreationType: "park" },
  { kind: "candidate", osmKey: "leisure", osmValue: "dog_park", internalCategory: "dog-parks", recreationType: "dog-park" },
  { kind: "candidate", osmKey: "leisure", osmValue: "golf_course", internalCategory: "golf", recreationType: "golf" },
  { kind: "candidate", osmKey: "leisure", osmValue: "pitch", internalCategory: "parks", recreationType: "park" }, // Many pitches are parks
  { kind: "candidate", osmKey: "leisure", osmValue: "fitness_centre", internalCategory: "gyms", recreationType: "gym" },
  { kind: "candidate", osmKey: "highway", osmValue: "path", internalCategory: "trails", recreationType: "trail" },
  { kind: "candidate", osmKey: "amenity", osmValue: "community_centre", internalCategory: "community-centers", recreationType: "community-center" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOverpassQuery(): string {
  let ql = `[out:json][timeout:90];\n`;
  // Bounding box for St. Louis and St. Charles counties roughly:
  // (south, west, north, east)
  const bbox = "38.3,-91.0,39.0,-90.1";
  ql += `(\n`;

  for (const mapping of TYPE_MAPPINGS) {
    ql += `  nwr["${mapping.osmKey}"="${mapping.osmValue}"](${bbox});\n`;
  }
  
  ql += `);\n`;
  ql += `out center;\n`;
  return ql;
}

async function fetchOsmData(): Promise<OsmNode[]> {
  const query = buildOverpassQuery();
  console.log("Fetching from Overpass API...");
  
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error! status: ${response.status}`);
  }

  const data = await response.json() as OsmResponse;
  return data.elements.filter(e => e.tags && e.tags.name);
}

// ─── Existing Data Reader ─────────────────────────────────────────────────────

async function loadExistingPlaces(): Promise<ExistingPlace[]> {
  const candidatesJson = await fs.readFile(path.resolve("build/candidate-index.json"), "utf8").catch(() => null);
  const restrictedJson = await fs.readFile(path.resolve("build/restricted-index.json"), "utf8").catch(() => null);

  const existing: ExistingPlace[] = [];
  
  if (candidatesJson) {
    const data = JSON.parse(candidatesJson);
    for (const id in data.places) {
      existing.push({
        id,
        name: data.places[id].name,
        location: data.places[id].location
      });
    }
  }

  if (restrictedJson) {
    const data = JSON.parse(restrictedJson);
    for (const id in data.sites) {
      existing.push({
        id,
        name: data.sites[id].name,
        location: data.sites[id].location
      });
    }
  }

  return existing;
}

// ─── Main Logic ───────────────────────────────────────────────────────────────

function determineCountyMapUrl(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

async function saveGroup(group: any, baseDir: string) {
  for (const [filePath, places] of Object.entries(group)) {
    const absolutePath = path.resolve(baseDir, filePath as string);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    let existingData: any = null;
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      existingData = JSON.parse(raw);
    } catch (e) {
      // file doesn't exist yet
    }

    if (!existingData) {
      const parts = (filePath as string).split("/");
      const isRestricted = baseDir.includes("restricted");
      
      if (isRestricted) {
         existingData = {
          version: "1.0.0",
          generatedAt: new Date().toISOString(),
          county: parts[1].replace(".json", ""),
          sourceKind: parts[0],
          sites: []
        };
      } else {
        existingData = {
          version: "1.0.0",
          generatedAt: new Date().toISOString(),
          county: parts[1].replace(".json", ""),
          category: parts[0],
          places: []
        };
      }
    }

    const arr = existingData.places || existingData.sites;
    arr.push(...(places as any[]));

    await fs.writeFile(absolutePath, JSON.stringify(existingData, null, 2), "utf8");
  }
}

async function main() {
  console.log("Loading existing places for deduplication...");
  const existing = await loadExistingPlaces();
  const existingMap = new Map<string, ExistingPlace[]>();
  
  existing.forEach(e => {
    if (e.location && e.location.lat !== null && e.location.lat !== undefined && e.location.lng !== null && e.location.lng !== undefined) {
      const key = `${e.location.lat.toFixed(3)},${e.location.lng.toFixed(3)}`;
      if (!existingMap.has(key)) existingMap.set(key, []);
      existingMap.get(key)!.push(e);
    }
  });
  console.log(`Loaded ${existing.length} existing places.`);

  const nodes = await fetchOsmData();
  console.log(`Found ${nodes.length} nodes from OSM (with names).`);

  let addedCandidates = 0;
  let addedRestricted = 0;

  const newCandidatesByFile: Record<string, any[]> = {};
  const newRestrictedByFile: Record<string, any[]> = {};

  for (const node of nodes) {
    const lat = node.center?.lat || node.lat;
    const lon = node.center?.lon || node.lon;
    if (!lat || !lon) continue;

    let isDuplicate = false;
    for (const ex of existing) {
      if (!ex.location || ex.location.lat === null || ex.location.lat === undefined || ex.location.lng === null || ex.location.lng === undefined) {
         continue;
      }
      const dist = getDistance(
        { latitude: lat, longitude: lon },
        { latitude: ex.location.lat, longitude: ex.location.lng }
      );
      if (dist < 50) {
         isDuplicate = true; break;
      }
      if (dist < 2000 && ex.name.toLowerCase() === node.tags!.name.toLowerCase()) {
         isDuplicate = true; break;
      }
    }

    if (isDuplicate) continue;

    // Determine type
    let matchedMapping = null;
    for (const mapping of TYPE_MAPPINGS) {
      if (node.tags![mapping.osmKey] === mapping.osmValue) {
        matchedMapping = mapping;
        break;
      }
    }
    
    if (!matchedMapping) continue;

    // Determine county naively (we could use proper geocoding but tags exist)
    // Actually OSM tags sometimes have county: `addr:county`
    let county = "st-louis-county"; // default
    if (node.tags!["addr:county"] === "St. Charles") county = "st-charles-county";
    else if (node.tags!["addr:city"]) {
        const c = node.tags!["addr:city"].toLowerCase();
        if (c.includes("st. charles") || c.includes("ofallon") || c.includes("st. peters") || c.includes("wentzville")) {
            county = "st-charles-county";
        }
    }
    // Alternatively just use geographic bounding box if necessary. But St Charles is entirely west of Missouri River roughly.
    if (lon < -90.4) { // rough split for some areas, but let's just default and sort out if we really need to.
         // Actually let's just randomly guess st louis county if we don't have enough data
         if (lon < -90.48 && lat > 38.74) county = "st-charles-county";
    }

    const slug = node.tags!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const address = node.tags!["addr:street"] ? `${node.tags!["addr:housenumber"] || ""} ${node.tags!["addr:street"]}`.trim() : undefined;
    const municipality = node.tags!["addr:city"];
    const website = node.tags!["website"];

    const now = new Date().toISOString();
    
    // Create new place ID
    const newId = `${matchedMapping.kind}:${matchedMapping.internalCategory}:${county}:${slug}-${node.id}`;

    // Add to existing memory to prevent self-duplicates
    existing.push({
        id: newId,
        name: node.tags!.name,
        location: { lat, lng: lon }
    });

    if (matchedMapping.kind === "candidate") {
        const obj = {
          id: newId,
          name: node.tags!.name,
          county,
          municipality,
          recreationType: matchedMapping.recreationType,
          address,
          location: { lat, lng: lon },
          googleMapsUrl: determineCountyMapUrl(lat, lon),
          websiteUrl: website,
          source: {
            id: `osm-${node.id}`,
            sourceType: "osm",
            sourceName: "OpenStreetMap",
            fetchedAt: now
          },
          isPublic: true,
          isActive: true,
          tags: ["generated-osm"],
          createdAt: now,
          updatedAt: now
        };

        const filePath = `${matchedMapping.internalCategory}/${county}.json`;
        if (!newCandidatesByFile[filePath]) newCandidatesByFile[filePath] = [];
        newCandidatesByFile[filePath].push(obj);
        addedCandidates++;

    } else {
        // restricted
        // PropertyType mapping
        let rType = "other";
        if (matchedMapping.internalCategory === "schools") rType = "school";
        if (matchedMapping.internalCategory === "childcare") rType = "childcare";
        
        const obj = {
          id: newId,
          name: node.tags!.name,
          county,
          municipality,
          restrictedPropertyType: rType,
          address,
          location: { lat, lng: lon },
          source: {
            id: `osm-${node.id}`,
            sourceType: "osm",
            sourceName: "OpenStreetMap",
            fetchedAt: now
          },
          needsVerification: true,
          createdAt: now,
          updatedAt: now
        };

        const filePath = `${matchedMapping.internalCategory}/${county}.json`;
        if (!newRestrictedByFile[filePath]) newRestrictedByFile[filePath] = [];
        newRestrictedByFile[filePath].push(obj);
        addedRestricted++;
    }
  }

  console.log(`Writing ${addedCandidates} candidates...`);
  await saveGroup(newCandidatesByFile, path.join(DATA_DIR, "candidates"));
  
  console.log(`Writing ${addedRestricted} restricted sites...`);
  await saveGroup(newRestrictedByFile, path.join(DATA_DIR, "restricted"));

  console.log("Done! Success.");
}

main().catch(console.error);
