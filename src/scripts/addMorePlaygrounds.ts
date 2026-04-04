import fs from "fs/promises";
import path from "path";

const PLACES = [
  { name: "Jaycee Park", address: "2805 Elm St" },
  { name: "Frontier Park", address: "500 S Riverside Dr" },
  { name: "Vogt Brothers Park", address: "500 Fairgrounds Road" },
  { name: "Kister Park", address: "408 S Main St" },
  { name: "Blanchette Park", address: "1900 W Randolph St" },
  { name: "McNair Park", address: "3100 Droste Rd" },
  { name: "Eco Park", address: "1802 N 2nd St" },
  { name: "Heatherbrook Park", address: "130 Wildwood Ct" },
  { name: "Schaefer Park", address: "1647 Wilshire Valley Dr" },
  { name: "Webster Park", address: "2201 S River Rd" },
  { name: "Laurel Park", address: "3000 McClay Valley Blvd" },
  { name: "New Town Park", address: "Civic Green Dr" },
  { name: "Boone's Lick Park", address: "1000 Rose Brae Dr" },
  { name: "Boonslick park", address: "Dardenne St" },
  { name: "Fox Hill Park", address: "3400 Kister Dr" },
  { name: "Charlestowne Playground", address: "3110 Waterwheel Pl" },
  { name: "McAuley Playground", address: "1360 St Peters Cottleville Rd" },
  { name: "Tot Lot Park", address: "259 Bellemeade Dr" },
  { name: "Wapelhorst Park", address: "1875 Muegge Rd" },
  { name: "Shady Springs Park", address: "3888 Shady Springs Ln" },
  { name: "Eise Park", address: "12103 Bourbon St" },
  { name: "Schneider/Kiwanis Park", address: "3596 Elm Point Rd" },
  { name: "Brendan's Playground", address: "810 Sheppard Dr" },
  { name: "Wild Sprouts", address: "3010 MO-94" },
  { name: "Ollie's Fun Forest", address: "101 City Centre Park Dr" },
  { name: "Spencer Creek Park", address: "200 Sutters Mill Rd" },
  { name: "DuSable Park Playground", address: "2006 N Main St" },
  { name: "Woodland Sports Park Playground", address: "1 Woodlands Pkwy" },
  { name: "City Centre Park", address: "1 St Peters Centre Blvd" },
  { name: "Zachary's Playground", address: "8392 Orf Rd" },
  { name: "Circle Park", address: "920 Circle Dr" },
  { name: "Fountain Lakes Park", address: "3850 Huster Rd" },
  { name: "Bangert Island", address: "1704 S River Rd" },
  { name: "Hawk Ridge Park", address: "1229 Ridgeway Ave" },
  { name: "Playground Ed Bales Area", address: "N Main St" },
  { name: "Rabbit Run Park", address: "10 Mayfield Rd" },
  { name: "Scott A. Lewis Park", address: "" },
  { name: "Central Park Chesterfield", address: "16365 Lydia Hill Dr" },
  { name: "Legacy Park", address: "5490 5th St" },
  { name: "Spanish Village Park", address: "12899 Spanish Village Dr" },
  { name: "Covenant Park", address: "2199 Willott Rd" },
  { name: "Vago Park", address: "2700 Fee Fee Rd" },
  { name: "Forget-Me-Not Park", address: "150 S Main St" },
  { name: "Parkwood Park", address: "3145 Parkwood Ln" },
  { name: "Missouri Bluffs Park", address: "100 Research Park Cir" },
  { name: "City Hall Park", address: "2032 Hanley Rd" },
  { name: "James McDonnell County Park", address: "2961 Adie Rd" },
  { name: "Graystone Park", address: "2232 Graystone Dr" },
  { name: "Heartland Park", address: "100 William Dierberg Dr" },
  { name: "O'Day Park", address: "1000 O'Day Park Drive" },
  { name: "McKelvey Park", address: "3220 McKelvey Rd" },
  { name: "Flatwoods Park", address: "2420 Hwy Y" },
  { name: "Nob Hill Park", address: "50 Sutters Mill Rd" },
  { name: "Paul A. Westhoff Park", address: "810 Sheppard Dr" },
  { name: "Legacy Playground", address: "5445 State Rte N" },
  { name: "Kennedy's Playground", address: "115 McMenamy Rd" },
  { name: "Jake's Field Of Dreams", address: "100 William Dierberg Dr" },
  { name: "Founders Park", address: "7 Freymuth Rd" },
  { name: "Tiemeyer Park", address: "3311 Ashby Rd" },
  { name: "Bridgeway Park", address: "11700 Brookford Ln" },
  { name: "Vlasis Park", address: "300 Park Dr" },
  { name: "Rotary Park", address: "2577 W Meyer Rd" },
  { name: "Matthews Park", address: "11050 Ayrshire Dr" },
  { name: "Manion Park", address: "15 Manion Park Dr" },
  { name: "St Vincent Park", address: "7335 St Charles Rock Rd" }
];

async function geocode(address: string): Promise<{ lat: number; lon: number, display_name: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MOSAIC-Recreation-App-Playgrounds2/1.0" } });
    if (!res.ok) return null;
    const data = await res.json() as any[];
    if (data && data.length > 0) {
      return { 
        lat: parseFloat(data[0].lat), 
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
  } catch (err) {}
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function loadExisting(file: string) {
  try {
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content);
  } catch (e) {
    const parts = file.split(path.sep);
    const filename = parts[parts.length - 1];
    return {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      county: filename.replace(".json", ""),
      sourceKind: "parks-with-playgrounds",
      sites: []
    };
  }
}

async function main() {
  const fileStCharles = path.resolve("data", "restricted", "parks-with-playgrounds", "st-charles-county.json");
  const fileStLouis = path.resolve("data", "restricted", "parks-with-playgrounds", "st-louis-county.json");

  const dataStCharles = await loadExisting(fileStCharles);
  const dataStLouis = await loadExisting(fileStLouis);

  let added = 0;

  for (const p of PLACES) {
    // Check if we already have it in either
    const exists1 = dataStCharles.sites.find((s: any) => s.name.includes(p.name));
    const exists2 = dataStLouis.sites.find((s: any) => s.name.includes(p.name));
    if (exists1 || exists2) {
      console.log(`Skipping ${p.name}, already restricted.`);
      continue;
    }

    console.log(`Geocoding: ${p.name}...`);
    await sleep(1500); 

    let location = await geocode(`${p.address}, Missouri`);
    if (!location) {
        location = await geocode(`${p.name}, Missouri`);
        await sleep(1500);
    }
    if (!location) {
        console.log(`  -> Failed to geocode ${p.name}`);
        continue;
    }

    let lat = location.lat;
    let lon = location.lon;

    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let county = "st-charles-county";
    
    // Roughly determine county string. Most of St. Louis County is east of St Charles
    if (location.display_name.includes("St. Louis County") || location.display_name.includes("Saint Louis County") || location.display_name.includes("City of St. Louis") || location.display_name.includes("St. Louis")) {
        county = "st-louis-county";
    }

    const newId = `restricted:park-with-playground:${county}:${slug}`;
    const dataset = county === "st-charles-county" ? dataStCharles : dataStLouis;
    
    const site = {
      id: newId,
      name: `${p.name} - Playground Area`,
      county: county,
      municipality: p.address || "Unknown",
      restrictedPropertyType: "park-with-playground",
      address: p.address || p.name,
      location: { lat, lng: lon },
      source: {
        id: `source-playground-batch2-${slug}`,
        sourceType: "manual",
        sourceName: "Google Maps Playgrounds Batch",
        fetchedAt: new Date().toISOString()
      },
      needsVerification: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataset.sites.push(site);
    added++;
    console.log(`  -> Added ${p.name} to ${county}.`);
  }

  if (added > 0) {
    await fs.mkdir(path.dirname(fileStCharles), { recursive: true });
    await fs.writeFile(fileStCharles, JSON.stringify(dataStCharles, null, 2), "utf8");
    await fs.writeFile(fileStLouis, JSON.stringify(dataStLouis, null, 2), "utf8");
    console.log(`\nSuccessfully added ${added} playgrounds to the restricted list.`);
  } else {
    console.log(`\nNo new playgrounds were added.`);
  }
}

main().catch(console.error);
