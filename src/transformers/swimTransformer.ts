import { Standard } from '../types';

/**
 * Transform a mapping of swim levels to cut strings into an ordered Standards
 * array. `levelsOrder` should be provided as an array of labels from lowest
 * (worst) to highest (best). If omitted, the function will return standards
 * in the iteration order of the input object.
 */
export function transformSwimmingStandards(
  mapping: Record<string, string>,
  levelsOrder?: string[]
): Standard[] {
  if (levelsOrder && levelsOrder.length > 0) {
    return levelsOrder.map((label) => {
      const cut = mapping[label];
      return { label, cut } as Standard;
    });
  }

  // Fallback: preserve object iteration order
  return Object.keys(mapping).map((label) => ({ label, cut: mapping[label] } as Standard));
}

export default transformSwimmingStandards;
