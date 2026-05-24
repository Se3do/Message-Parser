import { parse } from '../src';

it('narrow further', () => {
  const prefixes = [
    '!!@#$%^&*()_+, overloading the symbols {}',
    '!!@#$%^&*()_+, overloading the symbols {}:',
    '!!@#$%^&*()_+, overloading the symbols {}:"',
    '!!@#$%^&*()_+, overloading the symbols {}:"|',
    '!!@#$%^&*()_+, overloading the symbols {}:"|<>',
    '!!@#$%^&*()_+, overloading the symbols {}:"|<>?',
    '!!@#$%^&*()_+, overloading the symbols {}:"|<>?',
    // Test individual problematic chars
    '{}',
    '{}:'  ,
    '{}:"'  ,
    '{}:"|'  ,
    '{}:"|<>'  ,
    '{}:"|<>?'  ,
    // Test with just the braces
    'x{}y',
    'x{}:y',
    'x{}:"y',
    'a{b',
    'a}b',
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
