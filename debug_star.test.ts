import { parse } from './src';

it('does bold open at mid-word star?', () => {
  const tests = [
    '!!@#$%^&*()_+text',
    '*()_+text',
    'abc*()_+text',
    '*()_+text~blah~end',
  ];
  
  for (const input of tests) {
    const h = parse(input);
    const hh = JSON.stringify(h);
    console.log(`Input: "${input}"`);
    console.log(`  H: ${hh}`);
    console.log(`  has BOLD: ${hh.includes('BOLD')}`);
  }
});

it('compare bold open with and without leading chars', () => {
  // The exact position of * in the base text
  const a = '*()_+, ABC DEF GHI JKL';
  const b = '!!@#$%^&*()_+, ABC DEF GHI JKL';
  const c = '!!@#$%^& *()_+, ABC DEF GHI JKL';
  
  for (const [label, input] of [['start', a], ['mid', b], ['space', c]]) {
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    const hh = JSON.stringify(h);
    const pp = JSON.stringify(p);
    console.log(`\n${label}: "${input.substring(0, 30)}..."`);
    console.log(`  H: ${hh}`);
    console.log(`  P: ${pp}`);
    console.log(`  H has BOLD: ${hh.includes('BOLD')}, P has BOLD: ${pp.includes('BOLD')}`);
    console.log(`  H has STRIKE: ${hh.includes('STRIKE')}, P has STRIKE: ${pp.includes('STRIKE')}`);
    console.log(`  Match: ${hh === pp}`);
  }
});
