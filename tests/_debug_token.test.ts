import { parse } from '../src';
import { tokenize } from '../src/lexer';

it('debug strike tokenization', () => {
  const input = 'ok~, from now';
  const tokens = tokenize(input);
  console.log('Tokens:');
  for (const t of tokens) {
    console.log(`  kind=${t.kind} value=${JSON.stringify(t.value)} raw=${JSON.stringify(t.raw)}`);
  }
  const result = parse(input);
  console.log('Parse:', JSON.stringify(result));
  const peggy = parse(input, { engine: 'peggy' });
  console.log('PEGGY:', JSON.stringify(peggy));
});
