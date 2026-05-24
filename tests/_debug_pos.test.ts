import { parse } from '../src';
import { tokenize } from '../src/lexer';

it('minimal strike test', () => {
  // Find exactly where the ~ tokens are
  const prefix = 'ok';
  const input = `${prefix}~, from now~end`;
  const tokens = tokenize(input);
  console.log('Tokens:');
  for (const t of tokens) {
    console.log(`  kind=${t.kind} value=${JSON.stringify(t.value)} start=${t.start} end=${t.end}`);
  }
  console.log('tilde positions:');
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '~') {
      console.log(`  ~ at pos ${i}, char before: ${JSON.stringify(input[i-1])}, char after: ${JSON.stringify(input[i+1])}`);
    }
  }
});
