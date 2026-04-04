import { getDistance } from "geolib";
import type {
  LatLng,
  RestrictedSite,
  CandidatePlace,
  RestrictionFlags,
  RestrictedPropertyType,
} from "../types/core.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** 500 feet expressed in meters (the statutory proximity threshold). */
export const THRESHOLD_500FT_METERS = 152.4;

// ─── Local Types ──────────────────────────────────────────────────────────────

/** Result of a proximity check against a single restricted site. */
export interface ProximityResult {
  triggered: boolean;
  distanceFeet: number;
  sourceId: string;
  sourceName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

/**
 * Checks whether a location is within 500 ft of any site in the provided list.
 * Returns the result for the closest triggering site, or the closest site overall.
 */
export function checkProximity(
  location: LatLng,
  sites: RestrictedSite[]
): ProximityResult {
  let closest: { site: RestrictedSite; distanceMeters: number } | null = null;

  for (const site of sites) {
    if (site.location.lat === null || site.location.lng === null) continue;

    const distanceMeters = getDistance(
      { latitude: location.lat, longitude: location.lng },
      { latitude: site.location.lat, longitude: site.location.lng }
    );

    if (closest === null || distanceMeters < closest.distanceMeters) {
      closest = { site, distanceMeters };
    }

    // Short-circuit: found a triggering site
    if (distanceMeters <= THRESHOLD_500FT_METERS) {
      return {
        triggered: true,
        distanceFeet: Math.round(metersToFeet(distanceMeters)),
        sourceId: site.id,
        sourceName: site.name,
      };
    }
  }

  if (closest === null) {
    return { triggered: false, distanceFeet: Infinity, sourceId: "", sourceName: "" };
  }

  return {
    triggered: false,
    distanceFeet: Math.round(metersToFeet(closest.distanceMeters)),
    sourceId: closest.site.id,
    sourceName: closest.site.name,
  };
}

// ─── Restriction Flags ────────────────────────────────────────────────────────

const CHILD_FOCUSED_TYPES: RestrictedPropertyType[] = [
  "park-with-playground",
  "public-pool",
  "child-athletic-complex",
  "childrens-museum",
  "nature-or-education-center",
];

/**
 * Derives all restriction flags for a candidate place given the full list of
 * restricted sites. Each flag is independently evaluated.
 */
export function buildRestrictionFlags(
  place: CandidatePlace,
  restrictedSites: RestrictedSite[]
): RestrictionFlags {
  const byType = (types: RestrictedPropertyType[]) =>
    restrictedSites.filter((s) => types.includes(s.restrictedPropertyType));

  const nearSchool500ft = checkProximity(
    place.location,
    byType(["school"])
  ).triggered;

  const nearChildcare500ft = checkProximity(
    place.location,
    byType(["childcare"])
  ).triggered;

  const nearChildFocusedRecreation500ft = checkProximity(
    place.location,
    byType(CHILD_FOCUSED_TYPES)
  ).triggered;

  const hasPlaygroundTag = place.tags && place.tags.includes("playground");
  const hasSchoolTag = place.tags && place.tags.includes("school");

  // A place is considered on a restricted property if it has a playground tag,
  // or if its name exactly matches a restricted site and its coordinates are within ~10 meters.
  const onRestrictedProperty = hasPlaygroundTag || hasSchoolTag || restrictedSites.some((site) => {
    if (site.location.lat === null || site.location.lng === null) return false;
    if (site.name.toLowerCase() !== place.name.toLowerCase()) return false;
    const distanceMeters = getDistance(
      { latitude: place.location.lat, longitude: place.location.lng },
      { latitude: site.location.lat, longitude: site.location.lng }
    );
    return distanceMeters <= 10;
  });

  return {
    nearSchool500ft,
    nearChildcare500ft,
    nearChildFocusedRecreation500ft,
    onRestrictedProperty,
    specialReviewRequired: false,
  };
}
