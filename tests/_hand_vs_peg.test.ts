import { parse } from '../src';

const input = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEATx2 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x3 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x4 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEATx 5 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEAT x6 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. this can go long for some time, repeat x7 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. ,repeat x8 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.';

it('compare handwritten vs peggy', () => {
  const h = parse(input);
  const p = parse(input, { engine: 'peggy' });
  const hh = JSON.stringify(h);
  const pp = JSON.stringify(p);
  console.log('Match:', hh === pp);
  if (hh !== pp) {
    for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
      if (hh[i] !== pp[i]) {
        const start = Math.max(0, i - 150);
        console.log('H:', hh.substring(start, i + 150));
        console.log('P:', pp.substring(start, i + 150));
        // Find which section of the original input this corresponds to
        const contextStart = Math.max(0, i - 100);
        const rawIdx = hh.indexOf('\n', contextStart);
        // Also print the full parse results to understand
        break;
      }
    }
    // Find the first difference in the raw strings too
    const hRaw = JSON.stringify(h[0]?.value || []);
    const pRaw = JSON.stringify(p[0]?.value || []);
    for (let i = 0; i < Math.min(hRaw.length, pRaw.length); i++) {
      if (hRaw[i] !== pRaw[i]) {
        const start = Math.max(0, i - 200);
        console.log('==RAW DIVERGENCE==');
        console.log('H-raw:', hRaw.substring(start, i + 200));
        console.log('P-raw:', pRaw.substring(start, i + 200));
        break;
      }
    }
  }
  expect(hh === pp).toBe(true);
});
