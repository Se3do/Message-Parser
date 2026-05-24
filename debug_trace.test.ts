import { parse, TokenKind } from './src';

it('trace the issue', () => {
  const base = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;
  
  // Just the first occurence of ~ with relevant context
  const test1 = `ok~, from now REPEAT ok~, end`;
  console.log('Test1 (simple):');
  console.log('H:', JSON.stringify(parse(test1)));
  console.log('P:', JSON.stringify(parse(test1, { engine: 'peggy' })));
  
  // What if there's a * before the ~?
  const test2 = `*()_+...ok~, from now REPEAT *()_+...ok~, end`;
  console.log('Test2 (*+_+~...~):');
  console.log('H:', JSON.stringify(parse(test2)));
  console.log('P:', JSON.stringify(parse(test2, { engine: 'peggy' })));
  
  // What if the * is at the start?
  const test3 = `*()_+text ok~ text *()_+text ok~ end`;
  console.log('Test3 (*...~...*):');
  const h3 = JSON.stringify(parse(test3));
  const p3 = JSON.stringify(parse(test3, { engine: 'peggy' }));
  console.log('H:', h3);
  console.log('P:', p3);
  console.log('Match:', h3 === p3 ? 'YES' : 'NO');
  if (h3 !== p3) {
    for (let i = 0; i < Math.min(h3.length, p3.length); i++) {
      if (h3[i] !== p3[i]) {
        console.log(`Diff at ${i}: H=${h3.substring(i,i+60)} P=${p3.substring(i,i+60)}`);
        break;
      }
    }
  }
  
  // Progressively build up
  const test4 = `*()_+, abc def ghi jkl mno pqr stu vwx yz~, from now REPEAT *()_+, abc def ghi jkl mno pqr stu vwx yz~, end`;
  console.log('Test4 (longer text):');
  const h4 = JSON.stringify(parse(test4));
  const p4 = JSON.stringify(parse(test4, { engine: 'peggy' }));
  console.log('H:', h4);
  console.log('P:', p4);
  console.log('Match:', h4 === p4 ? 'YES' : 'NO');
  if (h4 !== p4) {
    for (let i = 0; i < Math.min(h4.length, p4.length); i++) {
      if (h4[i] !== p4[i]) {
        console.log(`Diff at ${i}: H=${h4.substring(i,i+60)} P=${p4.substring(i,i+60)}`);
        break;
      }
    }
  }
});
