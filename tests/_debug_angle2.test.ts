import { parse } from '../src';

it('angle with various chars', () => {
  const tests = [
    '<a~b',
    '<a*b',
    '<a_b',
    '<a`b',
    '<a[b',
    '<a|b',
    '<ab>',
    '<a*b>',  // valid angle link with * inside
  ];
  for (const input of tests) {
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    const match = JSON.stringify(h) === JSON.stringify(p);
    const status = match ? 'MATCH' : 'DIVERGE';
    console.log(`${status}: ${JSON.stringify(input)}`);
    if (!match) {
      console.log('  H:', JSON.stringify(h));
      console.log('  P:', JSON.stringify(p));
    }
  }
});
