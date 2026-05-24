import { parse } from '../src';
import { tokenize } from '../src/lexer';

it('debug exact positions', () => {
  const prefix = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok`;
  const suffix = `, from now on we repeat some.`;
  const input = `${prefix}~${suffix}, REPEATx2 ${prefix}~${suffix}`;
  
  console.log('Input length:', input.length);
  console.log('Base prefix length:', prefix.length);
  console.log('~ positions:');
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '~') {
      console.log(`  pos=${i} before[${i-3}..${i-1}]=${JSON.stringify(input.slice(Math.max(0,i-3),i))} after[${i+1}..${i+5}]=${JSON.stringify(input.slice(i+1,i+6))}`);
    }
  }
  
  const tokens = tokenize(input);
  console.log('\nTilde tokens:');
  for (const t of tokens) {
    if (t.kind === 'TILDE') {
      console.log(`  start=${t.start} end=${t.end} value=${JSON.stringify(t.value)} raw=${JSON.stringify(t.raw)}`);
    }
  }
});
