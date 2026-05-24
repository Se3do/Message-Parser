const { parse } = require('./src');
const { paragraph, plain, bold, italic, strike } = require('./tests/helpers');

// Test case 1: strike-heavy input (shortened)
const input = "This a message designed to stress test the message parser !!@#$%^&*()_+, overloading the symbols {}:\"|<>?, some more text ,./;'\\[], numbers 1234567890-= let it call s o s ok~, from now on we repeat some. REPEATx2 !!@#$%^&*()_+, overloading the symbols {}:\"|<>?, some more text ,./;'\\[], numbers 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x3 !!@#$%^&*()_+";

const result = parse(input);
console.log("=== ACTUAL ===");
console.log(JSON.stringify(result, null, 2));
