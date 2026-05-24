const { parse } = require('./src');
const s = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#\$%^&*()_+, overloading the symbols {}:\"|<>?, some more text ,./;'\\''[], numbers too 1234567890-= let it call s o s ok';
const r = parse(s);
console.log(JSON.stringify(r, null, 2));
