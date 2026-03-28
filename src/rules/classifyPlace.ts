import type {
  CandidatePlace,
  RestrictionFlags,
  AutoClassificationResult,
  PlaceClassification,
  DistanceCheck,
} from "../types/core.js";

export interface ClassificationContext {
  rulesVersion: string;
  /** All distance checks computed for this place — stored for audit purposes. */
  distanceChecks: DistanceCheck[];
}

const SUPERVISION_WARNING =
  "Individual supervision requirements may impose additional restrictions beyond automated checks. Always verify current statutes and local ordinances.";

export function classifyPlace(
  place: CandidatePlace,
  flags: RestrictionFlags,
  context: ClassificationContext
): AutoClassificationResult {
  const reasons: string[] = [];

  if (flags.onRestrictedProperty) {
    reasons.push("Place is located on a restricted property.");
  }
  if (flags.nearSchool500ft) {
    reasons.push("Place is within 500 ft of a school.");
  }
  if (flags.nearChildcare500ft) {
    reasons.push("Place is within 500 ft of a childcare facility.");
  }
  if (flags.nearChildFocusedRecreation500ft) {
    reasons.push("Place is within 500 ft of a child-focused recreation site.");
  }
  if (flags.specialReviewRequired) {
    reasons.push("Place has been flagged for special review.");
  }

  let classification: PlaceClassification;
  let summary: string;

  if (flags.onRestrictedProperty) {
    classification = "likely-excluded";
    summary = `${place.name} is likely excluded because it is located on a restricted property.`;
  } else if (
    flags.nearSchool500ft ||
    flags.nearChildcare500ft ||
    flags.nearChildFocusedRecreation500ft ||
    flags.specialReviewRequired
  ) {
    classification = "needs-review";
    summary = `${place.name} requires review due to proximity to a restricted site or a special review flag.`;
  } else {
    classification = "candidate";
    summary = `${place.name} has no proximity conflicts and is a candidate for inclusion.`;
  }

  return {
    placeId: place.id,
    classification,
    flags,
    explanation: {
      summary,
      reasons: [
        ...(reasons.length > 0 ? reasons : ["No restriction flags triggered."]),
        SUPERVISION_WARNING,
      ],
      distanceChecks: context.distanceChecks,
    },
    classifiedAt: new Date().toISOString(),
  };
}
