import { parse } from '../src';

it('check PEG underscore behavior', () => {
  const tests = [
    '()_+, overloading _',
    '&*()_+, overloading _',
    'x()_+, overloading y_z',
  ];
  for (const input of tests) {
    const p = parse(input, { engine: 'peggy' });
    console.log(`Input: "${input}"`);
    console.log('  P:', JSON.stringify(p));
  }
});
