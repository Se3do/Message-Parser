import { tokenize } from '../src/lexer';

it('check tokens for <', () => {
  const input = '<~, from now~end';
  const tokens = tokenize(input);
  console.log('Tokens:');
  for (const t of tokens) {
    console.log(`  kind=${t.kind} value=${JSON.stringify(t.value)} raw=${JSON.stringify(t.raw)} start=${t.start} end=${t.end}`);
  }
});
