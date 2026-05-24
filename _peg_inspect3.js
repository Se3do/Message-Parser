const peggy = require('peggy');
const fs = require('fs');
const grammar = fs.readFileSync('src/grammar.pegjs', 'utf8');
const src = peggy.generate(grammar, { output: 'source', format: 'commonjs' });

// Print full MaybeStrikethrough function 
let idx = src.indexOf('function peg$parseMaybeStrikethrough()');
let end = src.indexOf('\n  function ', idx + 5);
console.log('=== MaybeStrikethrough ===');
console.log(src.substring(idx, end));

// ItalicContent function
idx = src.indexOf('function peg$parseItalicContent(');
end = src.indexOf('\n  function ', idx + 5);
console.log('\n=== ItalicContent ===');
console.log(src.substring(idx, end));

// ItalicContentItem
idx = src.indexOf('function peg$parseItalicContentItem(');
end = src.indexOf('\n  function ', idx + 5);
console.log('\n=== ItalicContentItem ===');
console.log(src.substring(idx, end));

// Also find the action functions f85, f86, f87, f88, f89 etc
for (let i = 85; i <= 105; i++) {
  const pat = 'peg$f' + i + ' =';
  const fIdx = src.indexOf(pat);
  if (fIdx >= 0) {
    end = src.indexOf('\n', fIdx + 5);
    // Find the end of the function
    end = src.indexOf('function peg$', fIdx);
    if (end < 0) end = fIdx + 200;
    console.log('\n=== peg$f' + i + ' ===');
    console.log(src.substring(fIdx, Math.min(end, fIdx + 300)));
  }
}
