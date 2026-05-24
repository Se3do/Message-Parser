import { parse } from '../src';
import { tokenize } from '../src/lexer';

it('test the exact prefix text', () => {
  const text = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok';
  
  const h = parse(text);
  const p = parse(text, { engine: 'peggy' });
  const hh = JSON.stringify(h);
  const pp = JSON.stringify(p);
  
  console.log('Match:', hh === pp);
  
  if (hh !== pp) {
    for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
      if (hh[i] !== pp[i]) {
        console.log('H:', JSON.stringify(h));
        console.log('P:', JSON.stringify(p));
        break;
      }
    }
  }
});
