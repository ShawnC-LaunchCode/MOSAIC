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
    summary = `This location appears to be on or within a restricted property and likely conflicts with statutory restrictions. It is not recommended without further legal review.`;
  } else if (
    flags.nearSchool500ft ||
    flags.nearChildcare500ft ||
    flags.nearChildFocusedRecreation500ft ||
    flags.specialReviewRequired
  ) {
    classification = "needs-review";
    summary = `Possible conflicts were detected near this location. Further review is recommended before considering it a suitable option.`;
  } else {
    classification = "candidate";
    summary = `No nearby restriction zones were detected. This location may be a suitable recreation option, but individual restrictions may still apply.`;
  }

  return {
    placeId: place.id,
    classification,
    flags,
    explanation: {
      summary,
      reasons: reasons.length > 0 ? reasons : ["No restriction flags were triggered."],
      distanceChecks: context.distanceChecks,
    },
    classifiedAt: new Date().toISOString(),
  };
}
