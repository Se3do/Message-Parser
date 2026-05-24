import { parse } from '../src';

test('debug peg 3 sections', () => {
  const input = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEATx2 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x3 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.';

  const h = parse(input);
  const p = parse(input, { engine: 'peggy' });
  
  console.log('H top-level items:');
  h[0].value.forEach((v, i) => console.log(`  [${i}] ${v.type}${v.type === 'PLAIN_TEXT' ? ': "' + v.value.substring(0, 50) + '..."' : ''}${v.type !== 'PLAIN_TEXT' ? ': [' + v.value.map(x => x.type).join(', ') + ']' : ''}`));
  
  console.log('P top-level items:');
  p[0].value.forEach((v, i) => console.log(`  [${i}] ${v.type}${v.type === 'PLAIN_TEXT' ? ': "' + v.value.substring(0, 50) + '..."' : ''}${v.type !== 'PLAIN_TEXT' ? ': [' + v.value.map(x => x.type).join(', ') + ']' : ''}`));
  
  // EXTRA CHECK: directly print the PARAGRAPH item[1] if it exists
  if (p[0].value[1]) {
    console.log('P[1] full:', JSON.stringify(p[0].value[1]).substring(0, 200));
  }
  
  expect(true).toBe(true);
});
