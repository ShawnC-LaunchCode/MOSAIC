// ─── Types (inlined to avoid a build step) ────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

type PlaceClassification = "candidate" | "needs-review";
type RecreationType = string;
type County = "st-louis-county" | "st-charles-county";

interface PublicPlaceRecord {
  id: string;
  name: string;
  county: County;
  municipality?: string;
  recreationType: RecreationType;
  location: LatLng;
  googleMapsUrl?: string;
  websiteUrl?: string;
  finalClassification: PlaceClassification;
  summary: string;
  reasons: string[];
  warnings: string[];
  tags: string[];
  lastReviewedLabel: string;
}

interface PublicPlacesDataset {
  version: string;
  generatedAt: string;
  places: PublicPlaceRecord[];
}

// ─── State ────────────────────────────────────────────────────────────────────

let allPlaces: PublicPlaceRecord[] = [];

const filters = {
  county: "",
  type: "",
  classification: "",
};

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadPlaces(): Promise<void> {
  const res = await fetch("../public/places.json");
  if (!res.ok) throw new Error(`Failed to load places.json: ${res.status}`);
  const data: PublicPlacesDataset = await res.json();
  allPlaces = data.places;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function getFilteredPlaces(): PublicPlaceRecord[] {
  return allPlaces.filter((p) => {
    if (filters.county && p.county !== filters.county) return false;
    if (filters.type && p.recreationType !== filters.type) return false;
    if (filters.classification && p.finalClassification !== filters.classification) return false;
    return true;
  });
}

function populateTypeFilter(): void {
  const types = Array.from(new Set(allPlaces.map((p) => p.recreationType))).sort();
  const select = document.getElementById("filter-type") as HTMLSelectElement;
  for (const t of types) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = formatLabel(t);
    select.appendChild(opt);
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCounty(county: string, municipality?: string): string {
  const countyLabel = county === "st-louis-county" ? "St. Louis County" : "St. Charles County";
  return municipality ? `${municipality}, ${countyLabel}` : countyLabel;
}

function classificationClass(c: string): string {
  if (c === "candidate") return "badge badge--candidate";
  if (c === "needs-review") return "badge badge--review";
  return "badge";
}

function renderCard(place: PublicPlaceRecord): string {
  const locationLine = formatCounty(place.county, place.municipality);
  const badge = `<span class="${classificationClass(place.finalClassification)}">${formatLabel(place.finalClassification)}</span>`;
  const typeBadge = `<span class="badge badge--type">${formatLabel(place.recreationType)}</span>`;

  const reasonsHtml =
    place.reasons.length > 0
      ? `<ul class="reasons">${place.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>`
      : "";

  const warningsHtml =
    place.warnings.length > 0
      ? `<div class="warnings">${place.warnings.map((w) => `<p class="warning-item">${w}</p>`).join("")}</div>`
      : "";

  const mapsLink = place.googleMapsUrl
    ? `<a class="maps-link" href="${place.googleMapsUrl}" target="_blank" rel="noopener noreferrer">View on Google Maps</a>`
    : "";

  const websiteLink = place.websiteUrl
    ? `<a class="website-link" href="${place.websiteUrl}" target="_blank" rel="noopener noreferrer">Website</a>`
    : "";

  const links = [mapsLink, websiteLink].filter(Boolean).join(" ");

  return `
    <article class="place-card" data-id="${place.id}">
      <div class="card-header">
        <h2 class="place-name">${place.name}</h2>
        <div class="card-badges">${badge}${typeBadge}</div>
      </div>
      <p class="place-location">${locationLine}</p>
      <p class="place-summary">${place.summary}</p>
      ${reasonsHtml}
      ${warningsHtml}
      ${links ? `<div class="card-links">${links}</div>` : ""}
      <p class="card-meta">Last reviewed: ${place.lastReviewedLabel}</p>
    </article>
  `;
}

function render(): void {
  const grid = document.getElementById("place-grid")!;
  const countEl = document.getElementById("result-count")!;
  const filtered = getFilteredPlaces();

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">No places match the selected filters.</div>`;
  } else {
    grid.innerHTML = filtered.map(renderCard).join("");
  }

  countEl.textContent = `${filtered.length} place${filtered.length !== 1 ? "s" : ""}`;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function bindFilters(): void {
  const countySelect = document.getElementById("filter-county") as HTMLSelectElement;
  const typeSelect = document.getElementById("filter-type") as HTMLSelectElement;
  const classSelect = document.getElementById("filter-classification") as HTMLSelectElement;
  const resetBtn = document.getElementById("reset-filters") as HTMLButtonElement;

  countySelect.addEventListener("change", () => {
    filters.county = countySelect.value;
    render();
  });

  typeSelect.addEventListener("change", () => {
    filters.type = typeSelect.value;
    render();
  });

  classSelect.addEventListener("change", () => {
    filters.classification = classSelect.value;
    render();
  });

  resetBtn.addEventListener("click", () => {
    filters.county = "";
    filters.type = "";
    filters.classification = "";
    countySelect.value = "";
    typeSelect.value = "";
    classSelect.value = "";
    render();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    await loadPlaces();
    populateTypeFilter();
    bindFilters();
    render();
    document.getElementById("loading-msg")?.remove();
  } catch (err) {
    const grid = document.getElementById("place-grid")!;
    grid.innerHTML = `<div class="error-state">Failed to load places. Make sure <code>public/places.json</code> exists.</div>`;
    console.error(err);
  }
}

init();
