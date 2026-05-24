import { parse } from '../src';

it('strike with special chars inside', () => {
  // The prefix that appears inside the strike
  const inner = ', from now on we repeat some., REPEATx2 This has & star*()_+ chars';
  const input = `ok~${inner}~end`;
  const h = parse(input);
  const p = parse(input, { engine: 'peggy' });
  const hMatch = JSON.stringify(h).includes('STRIKE');
  const pMatch = JSON.stringify(p).includes('STRIKE');
  console.log('Input:', input);
  console.log('H:', JSON.stringify(h));
  console.log('P:', JSON.stringify(p));
  console.log('H has STRIKE:', hMatch, 'P has STRIKE:', pMatch);
});
