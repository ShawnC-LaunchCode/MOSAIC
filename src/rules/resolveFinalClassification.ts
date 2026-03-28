import type {
  AutoClassificationResult,
  ManualReview,
  PlaceClassification,
} from "../types/core.js";

export function resolveFinalClassification(
  autoResult: AutoClassificationResult,
  manualReview?: ManualReview
): PlaceClassification {
  return manualReview?.overrideClassification ?? autoResult.classification;
}
