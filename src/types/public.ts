import type { County, RecreationType, PlaceClassification, LatLng } from "./core.js";

/** A single place record shaped for frontend consumption. */
export interface PublicPlaceRecord {
  id: string;
  name: string;
  county: County;
  /** City or municipality within the county, if known. */
  municipality?: string;
  recreationType: RecreationType;
  location: LatLng;
  googleMapsUrl?: string;
  websiteUrl?: string;
  finalClassification: PlaceClassification;
  /** One-sentence human-readable classification summary. */
  summary: string;
  /** Reasons behind the classification (from ClassificationExplanation). */
  reasons: string[];
  /** Flags or cautions to surface to the user (e.g. "within 500ft of a school"). */
  warnings: string[];
  /** Searchable/filterable tags (e.g. recreation type, county, classification). */
  tags: string[];
  /** Display-friendly label for when this record was last reviewed, e.g. "March 2026". */
  lastReviewedLabel: string;
}

/** The public dataset written to disk and consumed by the static site. */
export interface PublicPlacesDataset {
  version: string;
  generatedAt: string; // ISO 8601
  places: PublicPlaceRecord[];
}
