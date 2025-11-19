# next-cut

`next-cut` provides a small TypeScript utility to compute a performance level
from a numeric metric and a set of standards.

Usage example:

```ts
import { computePerformance } from 'next-cut';

const standards = [
  { label: 'Excellent', cut: 90 },
  { label: 'Good', cut: 75 },
  { label: 'Average', cut: 50 },
  { label: 'Poor', cut: 0 }
];

console.log(computePerformance(82, standards, { direction: 'higher' }));
// -> { label: 'Good', index: 1, standard: { label: 'Good', cut: 75 } }

// With the enhanced result you also get the `nextStandard` and `diffToNext`:
// -> { label: 'Good', index: 1, standard: { ... }, nextStandard: { label: 'Excellent', cut: 90 }, diffToNext: { absolute: 8, relative: 8.888... } }

// By default the comparator assumes smaller values are better (`lower`).
// For min-based thresholds (where higher is better) pass the `direction`
// option:
//   computePerformance(82, standards, { direction: 'higher' })

// You can also ask the function to infer direction automatically with
// `direction: 'auto'`. When using `auto`, provide a `levels` schema so the
// function can determine monotonicity of the `cut` values:
//   computePerformance(value, standards, { direction: 'auto', levels: ['B','BB','A','AA'] })

// Validation: the function no longer throws for schema errors. Instead the
// returned `PerformanceResult` contains a `validation` object with
// `{ valid: boolean, errors: string[] }` describing any issues (missing
// labels, ordering violations, or auto-inference problems).

**API**

- **`Standard`**: `{ label: string; cut: number | string; id?: string; description?: string }` — a single threshold. `cut` is interpreted according to the `direction` option (see below).
- **`PerformanceResult`**: returned object with keys:
  - **`label`**: current level label (or `'unknown'` if none matched).
  - **`index`**: index in the `standards` array, or `-1` when no match.
  - **`standard`**: the matching `Standard` (when found).
  - **`nextStandard`**: the next better `Standard` to aim for, or `null`.
  - **`diffToNext`**: `{ absolute: number; relative: number } | null` (numeric diffs in seconds and percent).
  - **`diffToNextFormatted`**: `{ absolute: string; relative: string } | null` (formatted strings using `formatAbsolute` / `formatRelative`).
  - **`validation`**: `{ valid: boolean; errors: string[] }` with non-throwing validation messages (unless `validationMode: 'throw'`).

- **`PerformanceOptions`** highlights:
  - **`direction`**: `'higher' | 'lower' | 'auto'` (default `'lower'`).
  - **`levels`**: optional ordered list of labels (lowest → highest) used with `direction: 'auto'` and for validation.
  - **`parser`**: `(input: number | string) => number` to convert inputs (default understands `hh:mm:ss(.fff)`, `mm:ss(.fff)`, and seconds-only and returns seconds).
  - **`formatAbsolute`** / **`formatRelative`**: formatters for the string diffs (defaults shown in `src/types.ts`).


Examples
--------

String inputs and default formatting (time):

```ts
import { computePerformance } from 'next-cut';

const timeStandards = [
  { label: 'Fast', cut: '30' },
  { label: 'Moderate', cut: '60' },
  { label: 'Slow', cut: 'Infinity' }
];

// Use mm:ss.dd input (default parser understands it)
const r1 = computePerformance('2:30.00', timeStandards);
console.log(r1.label); // 'Slow'
console.log(r1.diffToNextFormatted); // { absolute: '1:30.00', relative: '150.0%' }

// Seconds-only string
const r2 = computePerformance('75.5', timeStandards);
console.log(r2.label); // 'Slow'
console.log(r2.diffToNextFormatted?.absolute); // '15.50'

// Custom parser and formatters
const res = computePerformance('75', timeStandards, {
  parser: (s) => Number(s),
  formatAbsolute: (n) => `${n} sec`,
  formatRelative: (p) => `${p.toFixed(1)}%`
});
console.log(res.diffToNextFormatted); // { absolute: '15 sec', relative: '25.0%' }

// validationMode: 'throw' will throw on schema errors
try {
  computePerformance(7, [{label:'A',cut:'10'},{label:'B',cut:'5'}], { direction: 'higher', levels: ['B','A'], validationMode: 'throw' });
} catch (err) {
  console.error('Validation failed:', err.message);
}

Swimming example (transformer)
--------------------------------

The package includes a small transformer to convert swimming standard JSON into a `Standard[]` array that `computePerformance` understands. Below is an example that mirrors the unit tests in `test/swimTransformer.test.ts`.

```javascript
import { transformSwimmingStandards, computePerformance } from 'next-cut';

// Example JSON mapping (string cuts)
const swimJson = {
  AAAA: '57.09',
  AAA: '59.79',
  AA: '1:02.49',
  A: '1:05.19',
  BB: '1:10.59',
  B: '1:16.09'
};

// Provide the levels order from lowest -> highest
const levelsOrder = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

// Transform into standards (keeps cuts as strings so the default parser will convert them)
const standards = transformSwimmingStandards(swimJson, levelsOrder);

// Now compute performance for a few sample metrics (strings or numbers). The
// list below includes a metric slower than `B` (no standard matches) and a
// metric faster than `AAAA` (best level).
const samples = ['1:20.00', '1:16.09', '1:10.59', '1:05.19', '1:02.49', '59.79', '57.09', 56];
for (const s of samples) {
  const r = computePerformance(s as any, standards, { direction: 'lower', levels: levelsOrder });
  console.log(`metric=${s} -> label=${r.currentStandard?.label}`);
  console.log('  diffToNext (numeric):', r.diffToNext); // { absolute: number, relative: number }
  console.log('  diffToNextFormatted (string):', r.diffToNextFormatted); // { absolute: string, relative: string }
}

// Sample output (actual run):

/*
metric=1:20.00 -> label=unknown
  diffToNext (numeric): { absolute: 3.9099999999999966, relative: 5.138651596793267 }
  diffToNextFormatted (string): { absolute: '03.91', relative: '5.1%' }
metric=1:17.00 -> label=unknown
  diffToNext (numeric): { absolute: 0.9099999999999966, relative: 1.195952161913519 }
  diffToNextFormatted (string): { absolute: '00.91', relative: '1.2%' }
metric=1:16.09 -> label=B
  diffToNext (numeric): { absolute: 5.5, relative: 7.79147187986967 }
  diffToNextFormatted (string): { absolute: '05.50', relative: '7.8%' }
metric=1:13.00 -> label=B
  diffToNext (numeric): { absolute: 2.4099999999999966, relative: 3.4140813146337963 }
  diffToNextFormatted (string): { absolute: '02.41', relative: '3.4%' }
metric=1:10.59 -> label=BB
  diffToNext (numeric): { absolute: 5.400000000000006, relative: 8.283479061205716 }
  diffToNextFormatted (string): { absolute: '05.40', relative: '8.3%' }
metric=1:08.00 -> label=BB
  diffToNext (numeric): { absolute: 2.8100000000000023, relative: 4.310477067034825 }
  diffToNextFormatted (string): { absolute: '02.81', relative: '4.3%' }
metric=1:05.19 -> label=A
  diffToNext (numeric): { absolute: 2.6999999999999957, relative: 4.320691310609691 }
  diffToNextFormatted (string): { absolute: '02.70', relative: '4.3%' }
metric=1:03.50 -> label=A
  diffToNext (numeric): { absolute: 1.009999999999998, relative: 1.6162586013762168 }
  diffToNextFormatted (string): { absolute: '01.01', relative: '1.6%' }
metric=1:02.49 -> label=AA
  diffToNext (numeric): { absolute: 2.700000000000003, relative: 4.515805318615158 }
  diffToNextFormatted (string): { absolute: '02.70', relative: '4.5%' }
metric=1:01.00 -> label=AA
  diffToNext (numeric): { absolute: 1.2100000000000009, relative: 2.0237497909349407 }
  diffToNextFormatted (string): { absolute: '01.21', relative: '2.0%' }
metric=59.79 -> label=AAA
  diffToNext (numeric): { absolute: 2.6999999999999957, relative: 4.729374671571196 }
  diffToNextFormatted (string): { absolute: '02.70', relative: '4.7%' }
metric=58.50 -> label=AAA
  diffToNext (numeric): { absolute: 1.4099999999999966, relative: 2.4697845507094 }
  diffToNextFormatted (string): { absolute: '01.41', relative: '2.5%' }
metric=57.09 -> label=AAAA
  diffToNext (numeric): null
  diffToNextFormatted (string): null
metric=56 -> label=AAAA
  diffToNext (numeric): null
  diffToNextFormatted (string): null
*/

// The transformer + computePerformance combination is covered by unit tests in `test/swimTransformer.test.ts`.
```

Standards use a single `cut` numeric field. Interpretation depends on the
`direction` option:

- `lower` (default): smaller metric is better; `cut` is treated as a
  maximum (metric <= cut).
- `higher`: larger metric is better; `cut` is treated as a minimum (metric >= cut).

When multiple standards match, the most specific one is chosen: for `lower`
the smallest matching `cut`, for `higher` the largest matching `cut`.
