import transformSwimmingStandards from '../src/transformers/swimTransformer';
import { computePerformance } from '../src/computePerformance';

describe('transformSwimmingStandards', () => {
  const swimJson = {
    AAAA: '57.09',
    AAA: '59.79',
    AA: '1:02.49',
    A: '1:05.19',
    BB: '1:10.59',
    B: '1:16.09'
  } as Record<string, string>;

  const levelsOrder = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA']; // lowest -> highest

  test('transforms and computePerformance recognizes all levels from no-cut to max', () => {
    const standards = transformSwimmingStandards(swimJson, levelsOrder);

    // metrics chosen so that we hit: unknown (no-cut), B, BB, A, AA, AAA, AAAA, faster than AAAA
    const metrics = [9999, '1:16.09', '1:10.59', '1:05.19', '1:02.49', '59.79', '57.09', '56'];
    const expected = ['unknown', 'B', 'BB', 'A', 'AA', 'AAA', 'AAAA', 'AAAA'];

    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const exp = expected[i];
      const res = computePerformance(m as any, standards, { direction: 'lower', levels: levelsOrder });
      expect(res.label).toBe(exp);
    }
  });
});
