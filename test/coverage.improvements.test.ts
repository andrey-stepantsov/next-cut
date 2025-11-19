import { computePerformance } from '../src/computePerformance';

describe('coverage improvements', () => {
  test('formats hours when diff >= 3600s', () => {
    const timeStandards = [
      { label: 'Fast', cut: 30 },
      { label: 'Moderate', cut: 60 },
      { label: 'Slow', cut: Infinity }
    ];

    // metric 1:01:30 => 3690s; next better is Moderate cut=60 => diff=3630 => 1:00:30.00
    const res = computePerformance('1:01:30', timeStandards);
    expect(res.label).toBe('Slow');
    expect(res.diffToNextFormatted?.absolute).toBe('1:00:30.00');
  });

  test('auto direction infers higher when levels cuts increase', () => {
    const standards = [
      { label: 'Low', cut: '10' },
      { label: 'High', cut: '20' }
    ];
    const levels = ['Low', 'High'];
    // metric 15 should fall into Low only if higher is used (metric >= cut)
    const res = computePerformance(15, standards, { direction: 'auto', levels });
    // With increasing cuts, auto should infer 'higher' and pick 'Low' as metric >= 10
    expect(res.label).toBe('Low');
    expect(res.validation?.valid).toBe(true);
  });

  test('auto direction handles decreasing levels (infers lower)', () => {
    const standards = [
      { label: 'A', cut: '10' },
      { label: 'B', cut: '5' }
    ];
    const levels = ['A', 'B'];
    const res = computePerformance(7, standards, { direction: 'auto', levels });
    expect(res.validation).toBeDefined();
    // cuts are decreasing, auto should infer 'lower' and validation should be valid
    expect(res.validation?.valid).toBe(true);
    expect(res.label).toBe('A');
  });

  test('reports parse error for metric strings', () => {
    const standards = [
      { label: 'X', cut: '10' }
    ];
    const res = computePerformance('not-a-number', standards);
    expect(res.validation?.valid).toBe(false);
    expect(res.validation?.errors.some((e) => /Unable to parse metric/.test(e))).toBe(true);
  });

  test('duplicate labels are reported in validation', () => {
    const standards = [
      { label: 'Dup', cut: '10' },
      { label: 'Dup', cut: '20' }
    ];
    const levels = ['Dup'];
    const res = computePerformance(15, standards, { levels });
    expect(res.validation?.valid).toBe(false);
    expect(res.validation?.errors.some((e) => /Duplicate standard label/.test(e))).toBe(true);
  });

  test('reports parse error when a standard cut cannot be parsed', () => {
    const standards = [
      { label: 'Low', cut: '10' },
      { label: 'NextBroken', cut: 'not-a-number' }
    ];
    const res = computePerformance(12, standards, { direction: 'higher' });
    expect(res.validation?.errors.some((e) => /Unable to parse cut value/.test(e))).toBe(true);
  });
});
