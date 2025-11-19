export type Standard = {
  /** Optional stable id */
  id?: string;
  /** Label to return when a metric falls into this standard */
  label: string;
  /**
   * Cut value. Interpretation depends on `direction`:
   * - `higher`: cut is a minimum threshold (metric >= cut)
   * - `lower`: cut is a maximum threshold (metric <= cut)
   *
   * Supports numeric or string input; a parser can convert strings to numbers.
   */
  cut: number | string;
  description?: string;
};

export type PerformanceResult = {
  label: string;
  index: number; // index into the standards array, -1 if none matched
  /** The currently achieved standard (the one that matched) */
  standard?: Standard;
  /** The next (better) standard to aim for, or null if already best/none */
  nextStandard?: Standard | null;
  /** Convenience object showing the next cut's label and original cut representation */
  nextCut?: { label: string; cut: string } | null;
  /** Difference to `nextStandard` in absolute units and relative percent */
  diffToNext?: { absolute: number; relative: number } | null;
  /** Validation information: non-throwing errors/warnings about schema */
  validation?: { valid: boolean; errors: string[] };
  /** Formatted versions of the diffs (using formatters from options or defaults) */
  diffToNextFormatted?: { absolute: string; relative: string } | null;
};

export type PerformanceOptions = {
  /**
   * Direction of comparison. If `higher` then larger metric values are better
   * (use `min` thresholds). If `lower` then smaller metric values are better
   * (use `max` thresholds). Default is `lower`.
   */
  direction?: 'higher' | 'lower' | 'auto';
  /**
   * Optional ordered list of level keys (labels) from lowest to highest.
   * When provided, every `Standard.label` must appear in this list and the
   * corresponding `cut` values must respect the order (enforced according
   * to `direction`).
   */
  levels?: string[];
  /**
   * Optional input parser: converts a `number|string` into a numeric value used
   * internally for comparisons. Default parser interprets time strings of the
   * form `hh:mm:ss.dd` into seconds.
   */
  parser?: (input: number | string) => number;
  /**
   * Optional absolute formatter: converts an absolute numeric difference into
   * a string. Default formats time in `hh:mm:ss.dd`.
   */
  formatAbsolute?: (value: number) => string;
  /**
   * Optional relative formatter: converts a relative percentage (number) into
   * a string. Default formats with 1 decimal digit and a trailing `%`.
   */
  formatRelative?: (percent: number) => string;
  /**
   * Validation mode: when validation issues are detected, `warn` will return
   * them in `result.validation` (default). `throw` will throw an Error with
   * the validation messages.
   */
  validationMode?: 'warn' | 'throw';
};
