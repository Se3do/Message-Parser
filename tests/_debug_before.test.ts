import { parse } from '../src';

it('strike with star before opener', () => {
  const testCases = [
    { name: 'star before opener', input: 'x*y~, from now~end' },
    { name: 'star+under before opener', input: 'x*y_z~, from now~end' },
    { name: 'star+under before and after', input: 'x*y_z~, from w*z_ now~end' },
  ];
  for (const tc of testCases) {
    const h = parse(tc.input);
    const p = parse(tc.input, { engine: 'peggy' });
    const hMatch = JSON.stringify(h).includes('STRIKE');
    const pMatch = JSON.stringify(p).includes('STRIKE');
    const status = hMatch === pMatch ? 'MATCH' : `MISMATCH`;
    console.log(`${status}: ${tc.name}`);
    if (hMatch !== pMatch) {
      console.log('  H:', JSON.stringify(h));
      console.log('  P:', JSON.stringify(p));
    }
  }
});
