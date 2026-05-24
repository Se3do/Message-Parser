const pegjs = require('peggy');
const fs = require('fs');
const grammar = fs.readFileSync('src/grammar.pegjs', 'utf8');
const code = pegjs.generate(grammar, {output: 'source', format: 'commonjs'});
const lines = code.split('\n');

// Find the function that contains line 6668 (the f88 call)
let start = -1;
let end = -1;
for (let i = 6650; i >= 0; i--) {
  if (lines[i].includes('function peg$parsemaybeitalic') || lines[i].includes('function ')) {
    // Check if this function includes line 6668
    for (let j = i; j < 6670; j++) {
      if (lines[j].includes('f88')) {
        start = i;
        break;
      }
    }
    if (start > 0) break;
  }
}

if (start > 0) {
  end = start + 1;
  let braceCount = 0;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('{')) braceCount += (lines[i].match(/{/g) || []).length;
    if (lines[i].includes('}')) braceCount -= (lines[i].match(/}/g) || []).length;
    if (braceCount <= 0) { end = i; break; }
  }
  for (let i = start; i <= end; i++) {
    console.log(i + ': ' + lines[i].substring(0, 200));
  }
}
