import { computePerformance } from '../src/computePerformance';

describe('input format error handling', () => {
  test('malformed metric string does not throw and reports validation error', () => {
    const standards = [
      { label: 'Low', cut: '10' },
      { label: 'High', cut: '20' }
    ];
    const res = computePerformance('not-a-time', standards);
    expect(res).toBeDefined();
    expect(res.validation).toBeDefined();
    expect(res.validation?.valid).toBe(false);
    expect(res.validation?.errors.some((e) => /Unable to parse metric/.test(e))).toBe(true);
  });

  test('malformed cut in standards is reported and does not throw', () => {
    const standards = [
      { label: 'X', cut: 'not-a-number' },
      { label: 'Y', cut: '30' }
    ];
    const res = computePerformance('25', standards);
    expect(res.validation).toBeDefined();
    expect(res.validation?.valid).toBe(false);
    expect(res.validation?.errors.some((e) => /Unable to parse cut value for standard 'X'/.test(e))).toBe(true);
  });

  test('custom parser that throws should be caught and reported (no throw)', () => {
    const standards = [
      { label: 'A', cut: '10' }
    ];
    const parser = (_: number | string) => {
      throw new Error('boom parser');
    };
    const res = computePerformance('12', standards, { parser });
    expect(res.validation).toBeDefined();
    expect(res.validation?.valid).toBe(false);
    expect(res.validation?.errors.some((e) => /Parser error/.test(e))).toBe(true);
  });

  test('validationMode throw still throws when enabled', () => {
    const standards = [
      { label: 'A', cut: 'not-a-number' }
    ];
    expect(() => computePerformance(12, standards, { validationMode: 'throw' })).toThrow();
  });
});
