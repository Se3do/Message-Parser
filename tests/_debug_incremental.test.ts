import { parse } from '../src';

// Base text that appears in each repeat
const base = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;

const repeats = [
  `, REPEATx2 ${base}~, from now on we repeat some.`,
  ` REPEAT x3 ${base}~, from now on we repeat some.`,
  ` REPEAT x4 ${base}~, from now on we repeat some.`,
  ` REPEATx 5 ${base}~, from now on we repeat some.`,
  `, REPEAT x6 ${base}~, from now on we repeat some.`,
  ` this can go long for some time, repeat x7 ${base}~, from now on we repeat some.`,
  `,repeat x8 ${base}~, from now on we repeat some.`,
];

it.each(repeats)('compare repeat: %s', (repeat) => {
  const full = base + repeat;
  const h = parse(full);
  const p = parse(full, { engine: 'peggy' });
  const hh = JSON.stringify(h);
  const pp = JSON.stringify(p);
  const match = hh === pp;
  console.log(`  Match: ${match}  H has BOLD: ${hh.includes('BOLD')}  P has BOLD: ${pp.includes('BOLD')}`);
  if (!match) {
    for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
      if (hh[i] !== pp[i]) {
        const start = Math.max(0, i - 80);
        console.log('  H:', hh.substring(start, i + 80));
        console.log('  P:', pp.substring(start, i + 80));
        break;
      }
    }
  }
});
