const peggy = require('peggy');
const fs = require('fs');
const grammar = fs.readFileSync('src/grammar.pegjs', 'utf8');
const src = peggy.generate(grammar, { output: 'source', format: 'commonjs' });

// Find Italic related functions
const patterns = [
  'parseMaybeItalic',
  'parseItalic',
  'parseItalicContent',
  'parseItalicContentItems',
  'parseItalicContentPreferentialItemPattern',
  'parseItalicContentFallbackItemPattern',
  'parseAnyItalic',
  'skipItalic',
];

for (const p of patterns) {
  const idx = src.indexOf(p);
  if (idx >= 0) {
    const start = Math.max(0, idx - 50);
    console.log(`\n=== ${p} at ${idx} ===`);
    console.log(src.substring(start, idx + 400));
  }
}
