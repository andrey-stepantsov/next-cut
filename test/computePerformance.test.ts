import { computePerformance } from '../src/computePerformance';

describe('computePerformance - threshold (higher better)', () => {
  const thresholds = [
    { label: 'Excellent', cut: 90 },
    { label: 'Good', cut: 75 },
    { label: 'Average', cut: 50 },
    { label: 'Poor', cut: 0 }
  ];

  test('enforces levels schema ordering (no-throw; validation.valid true)', () => {
    const levels = ['Poor', 'Average', 'Good', 'Excellent'];
    const res = computePerformance(82, thresholds, { direction: 'higher', levels });
    expect(res.validation).toBeDefined();
    expect(res.validation?.valid).toBe(true);
  });

  test('reports validation errors when levels ordering violated (no-throw)', () => {
    const bad = [
      { label: 'Excellent', cut: 90 },
      { label: 'Good', cut: 80 },
      { label: 'Average', cut: 85 }, // violates ordering between Average and Good
      { label: 'Poor', cut: 0 }
    ];
    const levels = ['Poor', 'Average', 'Good', 'Excellent'];
    const res = computePerformance(82, bad, { direction: 'higher', levels });
    expect(res.validation).toBeDefined();
    expect(res.validation?.valid).toBe(false);
    expect(res.validation?.errors.some((e) => /Ordering violation/.test(e))).toBe(true);
  });

  test('returns Good for 82', () => {
    // thresholds are min-based (higher is better), override default direction
    const res = computePerformance(82, thresholds, { direction: 'higher' });
    expect(res.currentStandard?.label).toBe('Good');
    expect(res.index).toBe(1);
    expect(res.nextStandard).toBeDefined();
    expect(res.nextStandard?.label).toBe('Excellent');
    expect(res.diffToNext).toBeDefined();
    expect(res.diffToNext?.absolute).toBeCloseTo(8);
    expect(res.diffToNext?.relative).toBeCloseTo((8 / 90) * 100);
  });

  test('returns Excellent for 95', () => {
    const res = computePerformance(95, thresholds, { direction: 'higher' });
    expect(res.currentStandard?.label).toBe('Excellent');
    expect(res.index).toBe(0);
    expect(res.nextStandard).toBeNull();
    expect(res.diffToNext).toBeNull();
  });

  test('returns unknown when no standards match', () => {
    const res = computePerformance(-1000, [{ label: 'Positive', cut: 0 }], { direction: 'higher' });
    expect(res.index).toBe(-1);
    expect(res.currentStandard).toBeNull();
    expect(res.nextStandard).toBeDefined();
    expect(res.nextStandard?.label).toBe('Positive');
    expect(res.diffToNext).toBeDefined();
    // next cut 0, metric -1000 -> abs diff 1000
    expect(res.diffToNext?.absolute).toBeCloseTo(1000);
  });
});

describe('computePerformance - range (lower better)', () => {
  // Lower time is better: ranges defined with max
  const timeStandards = [
    { label: 'Fast', cut: 30 },
    { label: 'Moderate', cut: 60 },
    { label: 'Slow', cut: Infinity }
  ];

  test('returns Moderate for 45', () => {
    // timeStandards are max-based (lower is better) — default is lower
    const res = computePerformance(45, timeStandards);
    expect(res.currentStandard?.label).toBe('Moderate');
    expect(res.nextStandard).toBeDefined();
    expect(res.nextStandard?.label).toBe('Fast');
    expect(res.diffToNext).toBeDefined();
    expect(res.diffToNext?.absolute).toBeCloseTo(15);
    expect(res.diffToNext?.relative).toBeCloseTo((15 / 30) * 100);
  });

  test('returns Slow for 120', () => {
    const res = computePerformance(120, timeStandards);
    expect(res.currentStandard?.label).toBe('Slow');
    expect(res.nextStandard).toBeDefined();
    expect(res.nextStandard?.label).toBe('Moderate');
    expect(res.diffToNext).toBeDefined();
    expect(res.diffToNext?.absolute).toBeCloseTo(60);
    expect(res.diffToNext?.relative).toBeCloseTo((60 / 60) * 100);
  });

  test('parses mm:ss.dd metric strings correctly', () => {
    const res = computePerformance('2:30.00', timeStandards);
    // 2:30.00 -> 150s, should be Slow (cut Infinity)
    expect(res.currentStandard?.label).toBe('Slow');
    expect(res.nextStandard).toBeDefined();
    expect(res.nextStandard?.label).toBe('Moderate');
    expect(res.diffToNext).toBeDefined();
    // absolute diff = 150 - 60 = 90
    expect(res.diffToNext?.absolute).toBeCloseTo(90);
    expect(res.diffToNextFormatted?.absolute).toBe('1:30.00');
    // relative = (90 / 60) * 100 = 150.0%
    expect(res.diffToNextFormatted?.relative).toBe('150.0%');
  });

  test('parses seconds-only metric strings correctly', () => {
    const res = computePerformance('75.5', timeStandards);
    // 75.5s should fall into Slow (cut Infinity)
    expect(res.currentStandard?.label).toBe('Slow');
    expect(res.nextStandard).toBeDefined();
    expect(res.nextStandard?.label).toBe('Moderate');
    expect(res.diffToNext).toBeDefined();
    // absolute diff = 75.5 - 60 = 15.5
    expect(res.diffToNext?.absolute).toBeCloseTo(15.5);
    expect(res.diffToNextFormatted?.absolute).toBe('15.50');
    // relative = (15.5 / 60) * 100 = 25.833... -> formatted 25.8%
    expect(res.diffToNextFormatted?.relative).toBe('25.8%');
  });

  test('accepts custom parser and formatters', () => {
    const standards = [
      { label: 'High', cut: '100' },
      { label: 'Low', cut: '50' }
    ];
    // custom parser: parse numeric strings with multiplier (e.g., '100x' -> 100)
    const parser = (v: number | string) => {
      if (typeof v === 'number') return v;
      const s = String(v).replace(/x$/, '');
      return Number(s);
    };
    const formatAbsolute = (n: number) => `${n}s`;
    const formatRelative = (p: number) => `${p.toFixed(1)} pct`;

    const res = computePerformance('75', standards, { parser, formatAbsolute, formatRelative, direction: 'higher' });
    expect(res.currentStandard?.label).toBe('Low');
    expect(res.diffToNextFormatted?.absolute).toBeDefined();
    expect(res.diffToNextFormatted?.relative).toMatch(/pct$/);
  });

  test('validationMode throw raises an error', () => {
    const bad = [
      { label: 'A', cut: '10' },
      { label: 'B', cut: '50' }
    ];
    const levels = ['B', 'A'];
    expect(() => computePerformance(7, bad, { direction: 'higher', levels, validationMode: 'throw' })).toThrow();
  });
});

describe('exact cut matching', () => {
  test('higher direction: metric exactly equals cut should match that level', () => {
    const standards = [
      { label: 'Low', cut: '50' },
      { label: 'Mid', cut: '75' },
      { label: 'High', cut: '100' }
    ];
    // direction higher: cut is minimum threshold (metric >= cut)
    const r1 = computePerformance(75, standards, { direction: 'higher' });
    expect(r1.currentStandard?.label).toBe('Mid');

    const r2 = computePerformance('100', standards, { direction: 'higher' });
    expect(r2.currentStandard?.label).toBe('High');
  });

  test('lower direction: metric exactly equals cut should match that level', () => {
    const standards = [
      { label: 'Fast', cut: '30' },
      { label: 'Moderate', cut: '60' },
      { label: 'Slow', cut: '120' }
    ];
    // direction lower: cut is maximum threshold (metric <= cut)
    const r1 = computePerformance('60.00', standards, { direction: 'lower' });
    expect(r1.currentStandard?.label).toBe('Moderate');

    const r2 = computePerformance(30, standards, { direction: 'lower' });
    expect(r2.currentStandard?.label).toBe('Fast');
  });
});
