import { parse } from '../src';

const base = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;

// Test just the base + x2
const input2 = base + `, REPEATx2 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;

it('test base + x2', () => {
  const h = parse(input2);
  const p = parse(input2, { engine: 'peggy' });
  const hh = JSON.stringify(h);
  const pp = JSON.stringify(p);
  console.log('Match:', hh === pp);
  console.log('H:', hh);
  console.log('P:', pp);
  if (hh !== pp) {
    for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
      if (hh[i] !== pp[i]) {
        const start = Math.max(0, i - 80);
        console.log('DIFF at', i, 'H:', hh.substring(start, i + 80));
        console.log('DIFF at', i, 'P:', pp.substring(start, i + 80));
        break;
      }
    }
  } else {
    // Check structure
    console.log('STRUCTURE MATCHES');
  }
});
