// Compare PEG vs handwritten for the stress test's first part
import { tokenize } from './src/lexer';
import { Parser, resolveParserOptions } from './src/parser';
import { resolveLexerOptions } from './src/lexer/Options';

const input = '*()_+ABC~DEF~GHI_JKL';
// Also test the actual pattern from the stress test  
const stressPart = '!!@#$%^&*()_+, overloading';

const tokens = tokenize(input, resolveLexerOptions({}));
const parserOpts = resolveParserOptions(resolveLexerOptions({}));
const parser = new Parser(tokens, parserOpts);
const result = parser.parse();
console.log(JSON.stringify(result, null, 2));
