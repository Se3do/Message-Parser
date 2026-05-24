import { parse } from '../src';
import { tokenize } from '../src/lexer';

it('narrow down issue', () => {
  // Test shorter versions of the prefix
  const prefixes = [
    'short',
    'short with * inside',
    'short with _ inside',
    'short with * and _',
    '!!@#$%^&*()_+',
    '!!@#$%^&*()_+, overloading',
    '!!@#$%^&*()_+, overloading the symbols {}:"|<>?',
  ];
  for (const prefix of prefixes) {
    const input = `${prefix}~, from now~end`;
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    const hMatch = JSON.stringify(h).includes('STRIKE');
    const pMatch = JSON.stringify(p).includes('STRIKE');
    const status = hMatch === pMatch ? 'MATCH' : `DIVERGE`;
    if (status === 'DIVERGE') {
      console.log(`${status}: prefix="${prefix}"`);
      console.log('  H:', JSON.stringify(h));
      console.log('  P:', JSON.stringify(p));
    }
  }
});
