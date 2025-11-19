import { Standard, PerformanceResult, PerformanceOptions } from './types';

// Default parser: parse time strings in `hh:mm:ss.dd` into seconds.
function defaultTimeParser(input: number | string): number {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return NaN;
  const s = input.trim();

  // 1) hh:mm:ss(.fff)
  let m = s.match(/^(\d+):([0-5]\d):([0-5]\d)(?:\.(\d+))?$/);
  if (m) {
    const hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    const seconds = parseInt(m[3], 10);
    const fraction = m[4] ? parseFloat('0.' + m[4]) : 0;
    return hours * 3600 + minutes * 60 + seconds + fraction;
  }

  // 2) mm:ss(.fff)
  m = s.match(/^(\d+):([0-5]\d)(?:\.(\d+))?$/);
  if (m) {
    const minutes = parseInt(m[1], 10);
    const seconds = parseInt(m[2], 10);
    const fraction = m[3] ? parseFloat('0.' + m[3]) : 0;
    return minutes * 60 + seconds + fraction;
  }

  // 3) seconds-only (integer or decimal), allow leading/trailing spaces
  m = s.match(/^(-?\d+)(?:\.(\d+))?$/);
  if (m) {
    return parseFloat(s);
  }

  // fallback: try Number
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

// Default absolute formatter: seconds -> hh:mm:ss.dd (hundredths)
function defaultFormatAbsolute(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  const hours = Math.floor(v / 3600);
  const minutes = Math.floor((v % 3600) / 60);
  const seconds = Math.floor(v % 60);
  const hundredths = Math.round((v - Math.floor(v)) * 100);
  // Minimal formatting: omit hours/minutes when not needed.
  // Always include seconds and two-digit fractional hundredths.
  if (hours > 0) {
    return `${sign}${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(hundredths)}`;
  }
  if (minutes > 0) {
    return `${sign}${minutes}:${pad2(seconds)}.${pad2(hundredths)}`;
  }
  return `${sign}${pad2(seconds)}.${pad2(hundredths)}`;
}

// Default relative formatter: percent with 1 decimal digit and trailing %
function defaultFormatRelative(percent: number): string {
  if (!Number.isFinite(percent)) return String(percent);
  return `${percent.toFixed(1)}%`;
}

function isMatchNum(metric: number, cutNum: number, direction: 'higher' | 'lower') {
  if (Number.isNaN(cutNum)) return false;
  if (direction === 'higher') return metric >= cutNum;
  return metric <= cutNum;
}

export function computePerformance(
  metric: number | string,
  standards: Standard[],
  options?: PerformanceOptions
): PerformanceResult {
  const errors: string[] = [];

  if (!Array.isArray(standards) || standards.length === 0) {
    errors.push('`standards` must be a non-empty array');
    return {
      label: 'unknown',
      index: -1,
      nextStandard: null,
      diffToNext: null,
      diffToNextFormatted: null,
      validation: { valid: false, errors }
    };
  }

  const parser = options?.parser ?? defaultTimeParser;
  const formatAbsolute = options?.formatAbsolute ?? defaultFormatAbsolute;
  const formatRelative = options?.formatRelative ?? defaultFormatRelative;

  // Determine direction
  let direction: 'higher' | 'lower' = 'lower';
  if (options?.direction === 'higher') direction = 'higher';
  else if (options?.direction === 'lower') direction = 'lower';
  else if (options?.direction === 'auto') {
    if (options?.levels) {
      const labelToStd = new Map<string, Standard>();
      for (const s of standards) labelToStd.set(s.label, s);
      const cuts: number[] = [];
      let canInfer = true;
      for (const lvl of options.levels) {
        const s = labelToStd.get(lvl);
        if (!s || s.cut === undefined) {
          canInfer = false;
          break;
        }
          const parsed = typeof s.cut === 'number' ? s.cut : parser(s.cut as any);
          if (Number.isNaN(parsed)) {
            canInfer = false;
            break;
          }
        cuts.push(parsed);
      }
      if (canInfer) {
        let increasing = true;
        let decreasing = true;
        for (let i = 1; i < cuts.length; i++) {
          if (!(cuts[i] > cuts[i - 1])) increasing = false;
          if (!(cuts[i] < cuts[i - 1])) decreasing = false;
        }
        if (increasing && !decreasing) direction = 'higher';
        else if (decreasing && !increasing) direction = 'lower';
        else {
          errors.push('Auto-direction inference failed: levels cuts are not monotonic; defaulting to "lower"');
          direction = 'lower';
        }
      } else {
        errors.push('Auto-direction inference failed: missing/invalid cuts for some levels; defaulting to "lower"');
        direction = 'lower';
      }
    } else {
      errors.push('Auto-direction inference requires `levels`; defaulting to "lower"');
      direction = 'lower';
    }
  }

  // Validate levels (non-throwing)
  if (options?.levels) {
    const levels = options.levels;
    const labelToStd = new Map<string, Standard>();
    for (const s of standards) {
      if (labelToStd.has(s.label)) {
        errors.push(`Duplicate standard label '${s.label}' in standards`);
      }
      labelToStd.set(s.label, s);
    }
    for (const lvl of levels) {
      if (!labelToStd.has(lvl)) {
        errors.push(`Level '${lvl}' is declared in options.levels but missing from standards`);
      }
    }
    // enforce ordering using parsed cuts (collect errors)
    for (let i = 0; i < levels.length - 1; i++) {
      const lowLabel = levels[i];
      for (let j = i + 1; j < levels.length; j++) {
        const highLabel = levels[j];
        const lowStd = labelToStd.get(lowLabel);
        const highStd = labelToStd.get(highLabel);
        if (!lowStd || !highStd) continue;
        const lowCut = typeof lowStd.cut === 'number' ? lowStd.cut : parser(lowStd.cut as any);
        const highCut = typeof highStd.cut === 'number' ? highStd.cut : parser(highStd.cut as any);
        if (Number.isNaN(lowCut) || Number.isNaN(highCut)) {
          errors.push(`Unable to parse cuts for levels '${lowLabel}' or '${highLabel}'`);
          continue;
        }
        if (direction === 'lower') {
          if (!(lowCut > highCut)) {
            errors.push(`Ordering violation: level '${lowLabel}' (cut=${lowCut}) should be > '${highLabel}' (cut=${highCut}) for direction 'lower'`);
          }
        } else {
          if (!(lowCut < highCut)) {
            errors.push(`Ordering violation: level '${lowLabel}' (cut=${lowCut}) should be < '${highLabel}' (cut=${highCut}) for direction 'higher'`);
          }
        }
      }
    }
  }

  // If validationMode is 'throw' and we have errors, throw now.
  if (options?.validationMode === 'throw' && errors.length > 0) {
    throw new Error('Validation errors: ' + errors.join('; '));
  }

  // Parse metric and standards into numeric values
  const metricNum = typeof metric === 'number' ? metric : parser(metric as any);
  if (Number.isNaN(metricNum)) errors.push('Unable to parse metric into a numeric value');

  const numericStandards: Array<{ idx: number; std: Standard; cutNum: number }> = [];
  for (let i = 0; i < standards.length; i++) {
    const s = standards[i];
    const cutRaw = s.cut;
    const cutNum = typeof cutRaw === 'number' ? cutRaw : parser(cutRaw as any);
    if (Number.isNaN(cutNum)) {
      errors.push(`Unable to parse cut value for standard '${s.label}'`);
    }
    numericStandards.push({ idx: i, std: s, cutNum });
  }

  // Find matches
  const matches: Array<{ idx: number; std: Standard; cutNum: number }> = [];
  for (const e of numericStandards) {
    if (!Number.isNaN(e.cutNum) && !Number.isNaN(metricNum) && isMatchNum(metricNum, e.cutNum, direction)) {
      matches.push(e);
    }
  }

  if (matches.length === 0) {
    // No matching standard (e.g., metric slower than all cuts for 'lower').
    // Instead of returning nulls, provide the nearest "next" standard so
    // callers can see how far they are from the next achievable level.
    let nextBest: Standard | null = null;
    if (Number.isFinite(metricNum)) {
      if (direction === 'higher') {
        // next is the smallest cut greater than metric
        const candidates = numericStandards
          .filter((e) => Number.isFinite(e.cutNum) && e.cutNum > metricNum)
          .sort((a, b) => a.cutNum - b.cutNum);
        if (candidates.length > 0) nextBest = candidates[0].std;
      } else {
        // direction === 'lower': next is the largest cut smaller than metric
        const candidates = numericStandards
          .filter((e) => Number.isFinite(e.cutNum) && e.cutNum < metricNum)
          .sort((a, b) => b.cutNum - a.cutNum);
        if (candidates.length > 0) nextBest = candidates[0].std;
      }
    }

    let diff: { absolute: number; relative: number } | null = null;
    let formatted: { absolute: string; relative: string } | null = null;
    if (nextBest && Number.isFinite(metricNum)) {
      const nextEntry = numericStandards.find((e) => e.std === nextBest);
      const nextCutNum = nextEntry ? nextEntry.cutNum : NaN;
      if (Number.isFinite(nextCutNum)) {
        if (direction === 'higher') {
          const abs = Math.max(0, nextCutNum - metricNum);
          const denom = Math.abs(nextCutNum) > 0 ? Math.abs(nextCutNum) : 1;
          const rel = (abs / denom) * 100;
          diff = { absolute: abs, relative: rel };
        } else {
          const abs = Math.max(0, metricNum - nextCutNum);
          const denom = Math.abs(nextCutNum) > 0 ? Math.abs(nextCutNum) : 1;
          const rel = (abs / denom) * 100;
          diff = { absolute: abs, relative: rel };
        }
        formatted = { absolute: formatAbsolute(diff.absolute), relative: formatRelative(diff.relative) };
      } else {
        errors.push('Unable to parse cut value for next standard');
      }
    }

      return {
        label: 'unknown',
        index: -1,
        nextStandard: nextBest,
        nextCut: buildNextCutObject(nextBest),
        diffToNext: diff,
        diffToNextFormatted: formatted,
        validation: { valid: errors.length === 0, errors }
      };
  }

  // Select best match
  let bestMatch = matches[0];
  if (direction === 'higher') matches.sort((a, b) => b.cutNum - a.cutNum);
  else matches.sort((a, b) => a.cutNum - b.cutNum);
  bestMatch = matches[0];

  const current = bestMatch.std;
  const currentCutNum = bestMatch.cutNum;

  // Find next better
  let next: Standard | null = null;
  if (direction === 'higher') {
    const candidates = numericStandards.filter((e) => Number.isFinite(e.cutNum) && e.cutNum > currentCutNum).sort((a, b) => a.cutNum - b.cutNum);
    if (candidates.length > 0) next = candidates[0].std;
  } else {
    const candidates = numericStandards.filter((e) => Number.isFinite(e.cutNum) && e.cutNum < currentCutNum).sort((a, b) => b.cutNum - a.cutNum);
    if (candidates.length > 0) next = candidates[0].std;
  }

  // Compute diff
  let diff: { absolute: number; relative: number } | null = null;
  if (next) {
    const nextCutEntry = numericStandards.find((e) => e.std === next);
    const nextCutNum = nextCutEntry ? nextCutEntry.cutNum : NaN;
    if (Number.isFinite(nextCutNum) && Number.isFinite(metricNum)) {
      if (direction === 'higher') {
        const abs = Math.max(0, nextCutNum - metricNum);
        const denom = Math.abs(nextCutNum) > 0 ? Math.abs(nextCutNum) : 1;
        const rel = (abs / denom) * 100;
        diff = { absolute: abs, relative: rel };
      } else {
        const abs = Math.max(0, metricNum - nextCutNum);
        const denom = Math.abs(nextCutNum) > 0 ? Math.abs(nextCutNum) : 1;
        const rel = (abs / denom) * 100;
        diff = { absolute: abs, relative: rel };
      }
    } else {
      errors.push('Unable to compute diff: next standard cut could not be parsed');
    }
  }

  const formatted = diff ? { absolute: formatAbsolute(diff.absolute), relative: formatRelative(diff.relative) } : null;

  // Build nextCut convenience object (preserve original representation if possible)
  function buildNextCutObject(s: Standard | null): { label: string; cut: string } | null {
    if (!s) return null;
    const cutRaw = s.cut;
    // Find parsed numeric value for formatting when cut is a number
    const parsed = typeof cutRaw === 'number' ? cutRaw : parser(cutRaw as any);
    const cutStr = typeof cutRaw === 'string' ? String(cutRaw) : (Number.isFinite(parsed) ? formatAbsolute(parsed) : String(cutRaw));
    return { label: s.label, cut: cutStr };
  }

  return {
    label: bestMatch.std.label,
    index: bestMatch.idx,
    standard: bestMatch.std,
    nextStandard: next,
    nextCut: buildNextCutObject(next),
    diffToNext: diff,
    diffToNextFormatted: formatted,
    validation: { valid: errors.length === 0, errors }
  };
}

export default computePerformance;

