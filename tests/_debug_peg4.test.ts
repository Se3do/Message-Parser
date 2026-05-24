import { parse } from '../src';

it('check PEG word underscore', () => {
  const tests = [
    'a_b',
    'a_ b',
    'a _b',
    'a _ b',
    'hello_world',
    'hello_ world',
    'hello _world',
    'hello _ world',
  ];
  for (const input of tests) {
    const p = parse(input, { engine: 'peggy' });
    console.log(`"${input}" → ${JSON.stringify(p)}`);
  }
});
