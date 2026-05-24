import { parse } from './src';

// Simple test for the basic strike
it('basic strike', () => {
  const input = `This a message ok~, from now on we repeat some. , REPEATx2 This a message ok~, from now on we repeat some.`;
  const h = parse(input);
  const hJson = JSON.stringify(h);
  console.log('H:', hJson);
  
  // Does it have STRIKE?
  const hasStrike = hJson.includes('STRIKE');
  console.log('Has STRIKE:', hasStrike);
  
  // Also test with PEG
  const p = parse(input, { engine: 'peggy' });
  const pJson = JSON.stringify(p);
  console.log('P:', pJson);
  const pHasStrike = pJson.includes('STRIKE');
  console.log('P has STRIKE:', pHasStrike);
});

it('base + segment 1', () => {
  const base = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;
  const input = base + ` , REPEATx2 ` + base;
  const h = parse(input);
  const hJson = JSON.stringify(h);
  console.log('H:', hJson);
  
  const hasStrike = hJson.includes('STRIKE');
  console.log('Has STRIKE:', hasStrike);
  
  const p = parse(input, { engine: 'peggy' });
  const pJson = JSON.stringify(p);
  console.log('P:', pJson);
  const pHasStrike = pJson.includes('STRIKE');
  console.log('P has STRIKE:', pHasStrike);
});

// Check what guards prevent strike
it('strike immediately after text', () => {
  // Simple - just a tilde
  const tests = [
    'hello~world~there',
    'a~b~c',
    'ok~, REPEAT~x',
    'ok~, from now on~, repeat',
  ];
  for (const t of tests) {
    const h = parse(t);
    const p = parse(t, { engine: 'peggy' });
    const hh = JSON.stringify(h);
    const pp = JSON.stringify(p);
    console.log(`Input: ${t}`);
    console.log(`  H: ${hh.includes('STRIKE') ? 'STRIKE' : 'plain'}`);
    console.log(`  P: ${pp.includes('STRIKE') ? 'STRIKE' : 'plain'}`);
  }
});
