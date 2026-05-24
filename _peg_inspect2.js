const peggy = require('peggy');
const fs = require('fs');
const grammar = fs.readFileSync('src/grammar.pegjs', 'utf8');
const src = peggy.generate(grammar, { output: 'source', format: 'commonjs' });

// Print full MaybeItalic function
let idx = src.indexOf('function peg$parseMaybeItalic');
console.log('=== FULL MaybeItalic ===');
let end = src.indexOf('\n  function ', idx + 5);
console.log(src.substring(idx, end));

// Also print the Italic function
idx = src.indexOf('function peg$parseItalic()');
if (idx < 0) idx = src.indexOf('function peg$parseItalic(');
console.log('\n=== FULL Italic ===');
end = src.indexOf('\n  function ', idx + 5);
console.log(src.substring(idx, end));
