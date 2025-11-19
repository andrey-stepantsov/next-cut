/* Node script that runs the swim transformer + computePerformance
   against the sample metrics used in the README and tests.
   It requires the project to be built (`npm run build`).
*/

const path = require('path');
const root = path.resolve(__dirname, '..');
const { computePerformance } = require(path.join(root, 'dist', 'src'));
const transformSwimmingStandards = require(path.join(root, 'dist', 'src', 'transformers', 'swimTransformer')).default;

const swimJson = {
  AAAA: '57.09',
  AAA: '59.79',
  AA: '1:02.49',
  A: '1:05.19',
  BB: '1:10.59',
  B: '1:16.09'
};

const levelsOrder = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];
const standards = transformSwimmingStandards(swimJson, levelsOrder);

const samples = ['1:16.09', '1:10.59', '59.79', '57.09', 9999];
for (const s of samples) {
  const r = computePerformance(s, standards, { direction: 'lower', levels: levelsOrder });
  console.log(`metric=${s} -> label=${r.label}`);
  console.log('  diffToNext (numeric):', r.diffToNext);
  console.log('  diffToNextFormatted (string):', r.diffToNextFormatted);
}
