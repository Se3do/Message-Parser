import { parse } from '../src';

it('debug base+x2 strike', () => {
  const baseBeforeTilde = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok`;
  const afterTilde = `, from now on we repeat some.`;
  const x2 = `, REPEATx2 ${baseBeforeTilde}~${afterTilde}`;
  const input = `${baseBeforeTilde}~${afterTilde}${x2}`;
  
  const h = parse(input);
  const p = parse(input, { engine: 'peggy' });
  console.log('Match:', JSON.stringify(h) === JSON.stringify(p));
  console.log('H:', JSON.stringify(h));
  console.log('P:', JSON.stringify(p));
  console.log('H has STRIKE:', JSON.stringify(h).includes('STRIKE'));
  console.log('P has STRIKE:', JSON.stringify(p).includes('STRIKE'));
});
