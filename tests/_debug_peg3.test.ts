import { parse } from '../src';

it('check PEG edge cases', () => {
  const tests = [
    '(_)',
    '(_) text',
    '(_) end',
    '(_)a',
    'a(_)b',
    '(_) more _ text',
    ')_(+) more _ text',
  ];
  for (const input of tests) {
    const p = parse(input, { engine: 'peggy' });
    console.log(`"${input}" → ${JSON.stringify(p)}`);
  }
});
