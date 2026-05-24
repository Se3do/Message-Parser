import { parse } from '../src';

it('check PEG _ between punctuation', () => {
  const tests = [
    '()_+ text _',
    '{_+ text _',
    ',_+ text _',
    '._+ text _',
    '(_) text',
    '(_+) text',
    '<_+ text _',
    '"_+ text _',
  ];
  for (const input of tests) {
    const p = parse(input, { engine: 'peggy' });
    console.log(`Input: "${input}"`);
    console.log('  P:', JSON.stringify(p));
  }
});
