import { parse } from '../src';

it('debug short pattern', () => {
  const r = parse('!!@#$%^&*()_+ABC');
  console.log('Result:', JSON.stringify(r));
  const p = parse('!!@#$%^&*()_+ABC', { engine: 'peggy' });
  console.log('PEGGY:', JSON.stringify(p));
});
