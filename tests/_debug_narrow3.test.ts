import { parse } from '../src';
import { tokenize } from '../src/lexer';

it('narrow to exact chars', () => {
  const prefixes = [
    '{}',
    '{}:',
    '{}:"',
    '{}:"|',
    '{}:"|<',
    '{}:"|<>',
    // Which char causes issue?
    'a{b',
    'a}b',
    'a:b',
    'a"b',
    'a|b',
    'a<b',
    'a>b',
    'a?b',
    // Check each individual
    '{',
    '}',
    ':',
    '"',
    '|',
    '<',
    '>',
    '?',
    // Combined
    '{}:'  ,
    '{}:"'  ,
    '{}:"|'  ,
    '{}:"|<'  ,
    '{}:"|<>'  ,
  ];
  for (const prefix of prefixes) {
    const input = `${prefix}~, from now~end`;
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    const hMatch = JSON.stringify(h).includes('STRIKE');
    const pMatch = JSON.stringify(p).includes('STRIKE');
    const status = hMatch === pMatch ? 'MATCH' : `DIVERGE`;
    if (status === 'DIVERGE') {
      console.log(`${status}: prefix="${prefix.replace(/\n/g, '\\n')}"`);
      console.log('  H:', JSON.stringify(h));
      console.log('  P:', JSON.stringify(p));
    }
  }
});
