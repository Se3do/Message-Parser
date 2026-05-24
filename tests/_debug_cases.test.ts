import { parse } from '../src';

it('verify strike in simple contexts', () => {
  // Test: just the core pattern with no surrounding text
  const testCases = [
    { name: 'simple', input: 'hey~, from now~end', expect: true },
    { name: 'with star before', input: 'x*y) _ + z~, from now~end', expect: true },
    { name: 'just strike text', input: 'prefix~inner~suffix', expect: true },
  ];
  for (const tc of testCases) {
    const h = parse(tc.input);
    const p = parse(tc.input, { engine: 'peggy' });
    const hMatch = JSON.stringify(h).includes('STRIKE');
    const pMatch = JSON.stringify(p).includes('STRIKE');
    const status = hMatch === pMatch ? 'MATCH' : `MISMATCH (h=${hMatch}, p=${pMatch})`;
    console.log(`${status}: ${tc.name} "${tc.input}"`);
    if (hMatch !== pMatch) {
      console.log('  H:', JSON.stringify(h));
      console.log('  P:', JSON.stringify(p));
    }
  }
});
