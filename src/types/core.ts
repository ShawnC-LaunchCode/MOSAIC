// ─── Unions ───────────────────────────────────────────────────────────────────

export type County =
  | "st-louis-county"
  | "st-charles-county";

export type RecreationType =
  | "trail"
  | "greenway"
  | "park"
  | "fishing"
  | "boat-ramp"
  | "golf"
  | "driving-range"
  | "gym"
  | "dog-park"
  | "community-center"
  | "museum"
  | "other";

export type ReviewStatus =
  | "unreviewed"
  | "auto-reviewed"
  | "manually-reviewed";

export type PlaceClassification =
  | "candidate"
  | "needs-review"
  | "likely-excluded";

export type SourceType =
  | "manual"
  | "osm"
  | "google-maps"
  | "county-data"
  | "state-data"
  | "other";

export type RestrictedPropertyType =
  | "school"
  | "childcare"
  | "park-with-playground"
  | "public-pool"
  | "child-athletic-complex"
  | "childrens-museum"
  | "nature-or-education-center";

// ─── Primitives ───────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

// ─── Distance Checks ──────────────────────────────────────────────────────────

/** Result of a proximity check against a single restricted site. */
export interface DistanceCheck {
  restrictedSiteId: string;
  restrictedSiteType: RestrictedPropertyType;
  distanceFt: number;
  withinThreshold: boolean;
}

// ─── Source Records ───────────────────────────────────────────────────────────

/** Provenance metadata for any place or site. */
export interface SourceRecord {
  id: string;
  sourceType: SourceType;
  sourceName: string;
  fetchedAt: string; // ISO 8601
}

// ─── Candidate Places ─────────────────────────────────────────────────────────

/** A recreation place being evaluated for inclusion in the directory. */
export interface CandidatePlace {
  id: string;
  name: string;
  county: County;
  municipality?: string;
  recreationType: RecreationType;
  address?: string;
  location: LatLng;
  googleMapsUrl?: string;
  websiteUrl?: string;
  isPublic?: boolean;
  isActive?: boolean;
  tags?: string[];
  source: SourceRecord;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── Restricted Sites ─────────────────────────────────────────────────────────

/** A property that triggers proximity-based exclusion rules. */
export interface RestrictedSite {
  id: string;
  name: string;
  county: County;
  municipality?: string;
  restrictedPropertyType: RestrictedPropertyType;
  address?: string;
  location: LatLng;
  source: SourceRecord;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── Classification Inputs ────────────────────────────────────────────────────

/** Boolean flags summarizing which restriction rules were triggered. */
export interface RestrictionFlags {
  nearSchool500ft: boolean;
  nearChildcare500ft: boolean;
  nearChildFocusedRecreation500ft: boolean;
  onRestrictedProperty: boolean;
  specialReviewRequired: boolean;
}

/** Human-readable explanation of how a classification was reached. */
export interface ClassificationExplanation {
  summary: string;
  /** Individual reasons that contributed to the classification. */
  reasons: string[];
  distanceChecks: DistanceCheck[];
}

// ─── Classification Results ───────────────────────────────────────────────────

/** Output of the automated classification pipeline for a single place. */
export interface AutoClassificationResult {
  placeId: string;
  classification: PlaceClassification;
  flags: RestrictionFlags;
  explanation: ClassificationExplanation;
  classifiedAt: string; // ISO 8601
}

// ─── Manual Reviews ───────────────────────────────────────────────────────────

/** A human override applied on top of the auto-classification. */
export interface ManualReview {
  placeId: string;
  reviewed: boolean;
  reviewedAt: string; // ISO 8601
  reviewer: string;
  overrideClassification: PlaceClassification;
  overrideReason: string;
  notes: string[];
}

// ─── Final Place Record ───────────────────────────────────────────────────────

/** The fully resolved record for a place after classification and any manual review. */
export interface PlaceRecord {
  place: CandidatePlace;
  autoResult: AutoClassificationResult;
  manualReview?: ManualReview;
  finalClassification: PlaceClassification;
  reviewStatus: ReviewStatus;
  updatedAt: string; // ISO 8601
}

// ─── Datasets ─────────────────────────────────────────────────────────────────

/** Raw file format for a county's restricted sites of one type. */
export interface RestrictedSiteDataset {
  version: string;
  generatedAt: string; // ISO 8601
  county: County;
  /** Folder-level category label, e.g. "schools", "parks-with-playgrounds". */
  sourceKind: string;
  sites: RestrictedSite[];
}

/** Raw file format for a county's candidate places of one category. */
export interface CandidatePlaceDataset {
  version: string;
  generatedAt: string; // ISO 8601
  county: County;
  category: RecreationType;
  places: CandidatePlace[];
}

/** In-memory spatial index of all restricted sites, keyed by id. */
export interface RestrictedIndex {
  generatedAt: string; // ISO 8601
  sites: Record<string, RestrictedSite>;
}

/** In-memory spatial index of all candidate places, keyed by id. */
export interface CandidateIndex {
  generatedAt: string; // ISO 8601
  places: Record<string, CandidatePlace>;
}

/** Output of the classification script — all place records. */
export interface ClassifiedPlacesDataset {
  version: string;
  generatedAt: string; // ISO 8601
  records: PlaceRecord[];
}

/** Persisted manual review overrides file. */
export interface ManualReviewDataset {
  version: string;
  generatedAt: string; // ISO 8601
  reviews: ManualReview[];
}
