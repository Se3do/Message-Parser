import { parse } from '../src';

it('debug strike with close', () => {
  const tests = [
    'ok~, from now~end',
    'ok~, from now REPEATx2 ok~, from now',
    'ok~, from now',
  ];
  for (const input of tests) {
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    console.log(`Input: "${input}"`);
    console.log('  H:', JSON.stringify(h));
    console.log('  P:', JSON.stringify(p));
    console.log('  H has STRIKE:', JSON.stringify(h).includes('STRIKE'));
    console.log('  P has STRIKE:', JSON.stringify(p).includes('STRIKE'));
  }
});
