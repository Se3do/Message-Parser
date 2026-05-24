import { parse } from '../src';

test('isolate three sections - exact pattern', () => {
  const sect1 = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.';
  // Exact 3-section pattern from _hand_vs_peg.test.ts
  const input = sect1 + ', REPEATx2 ' + sect1 + 'REPEAT x3 ' + sect1;
  
  const h = parse(input);
  const p = parse(input, { engine: 'peggy' });
  const hh = JSON.stringify(h);
  const pp = JSON.stringify(p);
  
  console.log('Input length:', input.length);
  console.log('Match:', hh === pp);
  if (hh === pp) {
    console.log('THEY MATCH!');
  } else {
    for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
      if (hh[i] !== pp[i]) {
        const start = Math.max(0, i - 150);
        console.log('H:', hh.substring(start, i + 150));
        console.log('P:', pp.substring(start, i + 150));
        break;
      }
    }
  }
  
  console.log('Underscores:');
  for (let i = 0; i < input.length; i++) if (input[i] === '_') console.log('  _ at', i);
  console.log('Tildes:');
  for (let i = 0; i < input.length; i++) if (input[i] === '~') console.log('  ~ at', i);
});
