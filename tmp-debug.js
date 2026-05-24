require('ts-node/register');
const fs = require('fs');
const { tokenize } = require('./src/lexer');
const { resolveLexerOptions } = require('./src/lexer/Options');
const { Parser, resolveParserOptions } = require('./src/parser');

const abuse = fs.readFileSync('./tests/abuse.test.ts', 'utf8');
const match = /`([\s\S]*?)`/.exec(abuse);
if (!match) {
  throw new Error('Failed to extract abuse test input.');
}
const input = match[1];
const lexerOptions = {
  colors: false,
  emoticons: false,
  katex: { dollarSyntax: false, parenthesisSyntax: false },
};
const tokens = tokenize(input, lexerOptions);
const lexerOpts = resolveLexerOptions(lexerOptions);
const parserOpts = resolveParserOptions(lexerOpts);
const ast = new Parser(tokens, parserOpts).parse();
const underscoreCount = tokens.filter((t) => t.kind === 'UNDERSCORE').length;
console.log('Underscore tokens:', underscoreCount);
const underscoreDetails = [];
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].kind === 'UNDERSCORE') {
    const next = tokens[i + 1];
    underscoreDetails.push({
      idx: i,
      next: next ? `${next.kind}:${next.raw}` : 'none',
    });
  }
}
console.log('Underscore next tokens:', underscoreDetails);
const parser = new Parser(tokens, parserOpts);
parser._stream.reset(43);
const boldTest = parser._parseAsteriskBold(new Set([require('./src/lexer').TokenKind.NEWLINE, require('./src/lexer').TokenKind.EOF]));
console.log('Bold test null:', boldTest === null);
const firstUnderscore = tokens.findIndex((t) => t.kind === 'UNDERSCORE');
parser._stream.reset(firstUnderscore);
const italicTest = parser._parseUnderscoreItalic(new Set([require('./src/lexer').TokenKind.NEWLINE, require('./src/lexer').TokenKind.EOF]));
console.log('Italic test null:', italicTest === null);
parser._stream.reset(firstUnderscore);
const italicNoNested = parser._parseUnderscoreItalic(
  new Set([require('./src/lexer').TokenKind.NEWLINE, require('./src/lexer').TokenKind.EOF]),
  { emphasisDepth: 1 },
);
console.log('Italic test (no nested) null:', italicNoNested === null);
const firstTilde = tokens.findIndex((t) => t.kind === 'TILDE');
const tildePositions = tokens
  .map((t, i) => (t.kind === 'TILDE' ? i : null))
  .filter((i) => i !== null)
  .slice(0, 5);
console.log('Tilde positions:', tildePositions);
if (tildePositions.length > 1) {
  console.log('First tilde token:', tokens[tildePositions[0]]);
  console.log('Second tilde token:', tokens[tildePositions[1]]);
}
parser._stream.reset(firstTilde);
const strikeTest = parser._parseTildeStrike(
  new Set([require('./src/lexer').TokenKind.NEWLINE, require('./src/lexer').TokenKind.EOF]),
);
console.log('Strike test null:', strikeTest === null);
console.log('Strike end pos:', parser._stream.mark());
const lastTilde = tokens.map((t, i) => (t.kind === 'TILDE' ? i : -1)).filter((i) => i !== -1).pop();
const lastUnderscore = tokens.map((t, i) => (t.kind === 'UNDERSCORE' ? i : -1)).filter((i) => i !== -1).pop();
console.log('Last tilde idx:', lastTilde, 'Last underscore idx:', lastUnderscore);
parser._stream.reset(firstUnderscore);
parser._advanceToken();
let nextUnderscorePos = -1;
let steps = 0;
while (!parser._stream.isEOF() && steps < 1000) {
  const t = parser._peekToken();
  if (t.kind === 'UNDERSCORE') {
    nextUnderscorePos = parser._stream.mark();
    break;
  }
  parser._advanceToken();
  steps++;
}
console.log('Next underscore stream pos:', nextUnderscorePos, 'steps', steps);
console.log(
  'Tokens after first underscore:',
  tokens.slice(firstUnderscore, firstUnderscore + 20).map((t) => `${t.kind}:${t.raw}`),
);
const starPositions = tokens
  .map((t, i) => (t.kind === 'ASTERISK' ? { i, start: t.start, end: t.end } : null))
  .filter(Boolean)
  .slice(0, 3);
console.log('First stars:', starPositions);
if (starPositions.length > 1) {
  const star = tokens[starPositions[1].i];
  console.log('Second star token:', star);
}
const para = ast[0];
if (para && para.type === 'PARAGRAPH') {
  const summary = para.value.slice(0, 20).map((node) => {
    if (node.type === 'PLAIN_TEXT') {
      return {
        type: node.type,
        len: node.value.length,
        hasStar: node.value.includes('*'),
        hasUnderscore: node.value.includes('_'),
        value: node.value.slice(0, 120),
      };
    }
    if (node.type === 'LINK') {
      return {
        type: node.type,
        src: node.value.src.value,
        label: node.value.label.map((n) => (n.type === 'PLAIN_TEXT' ? n.value : n.type)),
      };
    }
    return { type: node.type };
  });
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(JSON.stringify(ast, null, 2));
}
