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

console.log(computePerformance(82, standards));
// -> { label: 'Good', index: 1, standard: { label: 'Good', min: 75 } }

// With the enhanced result you also get the `nextStandard` and `diffToNext`:
// -> { label: 'Good', index: 1, standard: { ... }, nextStandard: { label: 'Excellent', min: 90 }, diffToNext: { absolute: 8, relative: 8.888... } }

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
console.log(r1.diffToNextFormatted); // { absolute: '00:01:30.00', relative: '150.0%' }

// Seconds-only string
const r2 = computePerformance('75.5', timeStandards);
console.log(r2.label); // 'Slow'
console.log(r2.diffToNextFormatted?.absolute); // '00:00:15.50'

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

```

Standards use a single `cut` numeric field. Interpretation depends on the
`direction` option:

- `lower` (default): smaller metric is better; `cut` is treated as a
  maximum (metric <= cut).
- `higher`: larger metric is better; `cut` is treated as a minimum (metric >= cut).

When multiple standards match, the most specific one is chosen: for `lower`
the smallest matching `cut`, for `higher` the largest matching `cut`.
