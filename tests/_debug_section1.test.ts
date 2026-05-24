import { parse } from '../src';

test('isolate first section', () => {
  // Just section1: has _ at position 126 and ~ at 234
  const sect1 = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.';
  
  const h = parse(sect1);
  const p = parse(sect1, { engine: 'peggy' });
  const hh = JSON.stringify(h);
  const pp = JSON.stringify(p);
  
  console.log('Section1 length:', sect1.length);
  console.log('Match:', hh === pp);
  if (hh === pp) {
    console.log('THEY MATCH!');
  } else {
    for (let i = 0; i < Math.min(hh.length, pp.length); i++) {
      if (hh[i] !== pp[i]) {
        const start = Math.max(0, i - 100);
        console.log('H:', hh.substring(start, i + 100));
        console.log('P:', pp.substring(start, i + 100));
        break;
      }
    }
  }
  
  console.log('\nH tree:');
  function show(node, indent) {
    if (Array.isArray(node)) { node.forEach(n => show(n, indent)); return; }
    if (typeof node !== 'object') { console.log(indent + node); return; }
    if (node.type) {
      console.log(indent + node.type + (node.value ? ' [' + (Array.isArray(node.value) ? node.value.length + ' children' : '') + ']' : ''));
      if (node.type === 'PLAIN_TEXT' || node.type === 'PLAIN') {
        console.log(indent + '  text: "' + node.value.substring(0, 60) + '..."');
      }
      if (Array.isArray(node.value)) {
        show(node.value, indent + '  ');
      }
    }
  }
  console.log('H:'); show(h, '  ');
  console.log('P:'); show(p, '  ');
});
