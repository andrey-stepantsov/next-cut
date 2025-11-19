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

// Use a comprehensive set of samples including:
//  - below B (slower than the worst cut),
//  - between each two adjacent standards (mid-range examples), and
//  - above AAAA (faster than the best cut)
const samples = [
  '1:20.00', // slower than B (no standard match)
  '1:17.00', // between B and BB
  '1:16.09', // exactly B
  '1:13.00', // between BB and A
  '1:10.59', // exactly BB
  '1:08.00', // between BB and A
  '1:05.19', // exactly A
  '1:03.50', // between A and AA
  '1:02.49', // exactly AA
  '1:01.00', // between AA and AAA
  '59.79',   // exactly AAA
  '58.50',   // between AAA and AAAA
  '57.09',   // exactly AAAA
  56         // faster than AAAA
];
for (const s of samples) {
  const r = computePerformance(s, standards, { direction: 'lower', levels: levelsOrder });
  console.log(`metric=${s} -> label=${r.label}`);
  console.log('  diffToNext (numeric):', r.diffToNext);
  console.log('  diffToNextFormatted (string):', r.diffToNextFormatted);
}
