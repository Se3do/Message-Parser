import { parse } from '../src';

it('check handmade for ()_+', () => {
  const input = '()_+, overloading _';
  const h = parse(input);
  const p = parse(input, { engine: 'peggy' });
  console.log('H:', JSON.stringify(h));
  console.log('P:', JSON.stringify(p));
  console.log('Match:', JSON.stringify(h) === JSON.stringify(p));
});
