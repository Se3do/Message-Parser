import { parse } from './src';

it('just two bases concatenated', () => {
  const base = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;
  
  // Concatenate base + base directly
  const tests = [
    ['just base', base],
    ['base+base', base + base],
    ['base+comma+base', base + ',' + base],
    ['base+space+base', base + ' ' + base],
    ['base+", REPEATx2 "+base', base + ` , REPEATx2 ` + base],
    ['base+", x "+base', base + ` , x ` + base],
  ];
  
  for (const [label, input] of tests) {
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    const hh = JSON.stringify(h);
    const pp = JSON.stringify(p);
    const hStrike = hh.includes('STRIKE');
    const pStrike = pp.includes('STRIKE');
    const match = hh === pp ? 'MATCH' : 'DIFF';
    console.log(`${label}: H=${hStrike ? 'STRIKE' : 'plain'} P=${pStrike ? 'STRIKE' : 'plain'} [${match}]`);
    if (!match) {
      for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
        if (hh[i] !== pp[i]) {
          console.log(`  First diff at ${i}`);
          console.log(`  H: ${hh.substring(Math.max(0,i-40), i+40)}`);
          console.log(`  P: ${pp.substring(Math.max(0,i-40), i+40)}`);
          break;
        }
      }
    }
  }
});
