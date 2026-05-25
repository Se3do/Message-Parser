# Message Parser

> Personal fork of `@rocket.chat/message-parser` — converts chat messages into structured AST.
> Dual-engine design: a PEG grammar reference and a fast handwritten parser.
> Written in TypeScript, tree-shakable, 814 passing tests.

---

**Disclaimer:** This is a personal fork of the [Rocket.Chat message-parser](https://github.com/RocketChat/fuselage/tree/main/packages/message-parser). Not affiliated with Rocket.Chat.

---

## Installation

```sh
npm install @rocket.chat/message-parser
```

## Usage

```ts
import { parse } from '@rocket.chat/message-parser';

const ast = parse('Hello **world**!');
```

```ts
const ast = parse('Hello **world**!', {
  colors: true,
  emoticons: true,
  katex: true,
  customDomains: ['intranet.example.com'],
});
```

```ts
// Use the PEG grammar as the parser engine (default is handwritten)
const ast = parse('Hello **world**!', { engine: 'peggy' });
```

## API

### `parse(message, options?)`

| Param     | Type     | Default | Description          |
|-----------|----------|---------|----------------------|
| `message` | `string` | —       | Raw chat message     |
| `options` | `object` | `{}`    | Parser options (see below) |

### Options

| Option          | Type                   | Default          | Description                           |
|-----------------|------------------------|------------------|---------------------------------------|
| `colors`        | `boolean`              | `false`          | Parse `color:#RGB` / `color:#RRGGBB`  |
| `emoticons`     | `boolean`              | `false`          | Convert `:)` `:D` `<3` etc. to emoji  |
| `katex`         | `boolean`              | `false`          | Parse `$...$` / `$$...$$` KaTeX math  |
| `customDomains` | `string[]`             | `[]`             | Extra TLDs for URL auto-linking        |
| `engine`        | `'peggy' \| 'handwritten'` | `'handwritten'` | Parser engine                      |

### Lower-level exports

- `isNodeOfType(node, kind)` — type guard for AST nodes
- `Token`, `TokenKind` — token type definitions
- `tokenize(message)` — lexer-only pass (returns token stream)
- `Lexer`, `Parser`, `TokenStream` — internal classes

> `parser` (function) and `MarkdownAST` (type) are deprecated aliases for `parse` and `Root`.

## Supported markup

### Blocks

| Feature        | Syntax                         | Example                             |
|----------------|--------------------------------|-------------------------------------|
| Quote          | `> ` prefix                    | `> hello`                           |
| Heading        | `#` `##` `###` `####` prefix  | `# Title`                           |
| Unordered list | `- ` or `* ` prefix           | `- item`                            |
| Ordered list   | `1. ` prefix                   | `1. item`                           |
| Task list      | `- [ ] ` / `- [x] ` prefix    | `- [x] done`                        |
| Code fence     | `` ``` `` triple backtick      | `` ```ts ``` ``                     |
| Block spoiler  | `||` on its own lines          | `\|\|...\|\|`                       |
| BigEmoji       | 1–3 emoji only in message      | `😀 🎉`                             |

### Inline

| Feature           | Syntax                     | Example                                   |
|-------------------|----------------------------|--------------------------------------------|
| Bold              | `**text**`                 | `**bold**`                                |
| Italic            | `_text_`                   | `_italic_`                                |
| Strikethrough     | `~text~`                   | `~strike~`                                |
| Inline code       | `` `code` ``               | `` `const x = 1` ``                      |
| Inline spoiler    | `\|\|text\|\|`             | `\|\|secret\|\|`                         |
| Link              | `[text](url)`              | `[Rocket.Chat](https://rc.chat)`          |
| Image             | `![alt](url)`              | `![logo](image.png)`                      |
| Angle link        | `<url\|label>`             | `<https://rc.chat\|Chat>`                 |
| Mention (user)    | `@username`                | `@john`                                   |
| Mention (channel) | `#channel`                 | `#general`                                |
| Emoji             | `:emoji_name:`             | `:rocket:`                                |
| Emoticon          | Text-to-emoji              | `:)` `:D` `:P` `<3`                      |
| KaTeX inline      | `$...$` or `\(...\)`      | `$E=mc^2$`                                |
| KaTeX block       | `$$...$$` or `\[...\]`    | `$$E=mc^2$$`                              |
| URL auto-link     | Bare URL                   | `https://rocket.chat`                     |
| Email auto-link   | `user@domain`              | `user@rocket.chat`                        |
| Color             | `color:#RRGGBB`            | `color:#ff0000`                           |
| Phone             | `+1234567890`              | `+1234567890`                             |
| Escaped char      | `\*` `\_` `\~`            | `\*not italic\*`                          |
| Line break        | Two trailing spaces + `\n` | `line 1··\nline 2`                        |

### Timestamps

Accepts Unix timestamps, ISO 8601 dates, and time-only values:

- `<t:1234567890>` — Unix timestamp
- `<t:2025-07-22T10:00:00.000Z>` — ISO 8601
- `<t:10:00:t>` — time-only (HH:MM or HH:MM:SS)

Optional format modifier:

| Format | Description               | Example                                 |
| ------ | ------------------------- | --------------------------------------- |
| `t`    | Short time                | 12:00 AM                                |
| `T`    | Long time                 | 12:00:00 AM                             |
| `d`    | Short date                | 12/31/2020                              |
| `D`    | Long date                 | Thursday, December 31, 2020             |
| `f`    | Full date and time        | Thursday, December 31, 2020 12:00 AM    |
| `F`    | Full date and time (long) | Thursday, December 31, 2020 12:00:00 AM |
| `R`    | Relative time             | 1 year ago                              |

## Engines

Two parser implementations:

- **PEG grammar** (`engine: 'peggy'`) — the reference implementation, a formal grammar in `grammar.pegjs`. Comprehensive but slower.
- **Handwritten** (`engine: 'handwritten'`, default) — hand-coded recursive descent parser. Faster, designed for real-time rendering.

Both produce identical ASTs (verified by 814 tests across both engines). Use `'peggy'` when you need strict spec compliance; use `'handwritten'` for performance-sensitive rendering.

## Improvements over PEG

The handwritten parser includes fixes and improvements not present in the original PEG grammar:

- **CommonMark intraword underscore rule** — `_` does not open emphasis when preceded by a word character. `text_hello_` and `some_snake_case_text` remain plain text rather than being parsed as italic.
- **Deterministic strike/italic ordering** — when `~` and `_` compete at the same nesting level, strike wins predictably. PEG's backtracking can produce inconsistent results depending on input length and token positions.
- **Performance** — **~45x faster on average** (5.6x–265x range depending on message type). The handwritten parser avoids PEG's backtracking overhead, especially on emoji, mentions, and code blocks.

Run `yarn bench:compare` to see the full per-category breakdown.

## Benchmarks

```sh
yarn bench        # full suite
yarn bench:parser # parser throughput
yarn bench:lexer  # lexer throughput
yarn bench:compare # handwritten vs PEG comparison
yarn bench:size   # bundle size
```

## Contributing

- **Grammar bugs**: edit `grammar.pegjs`, then regenerate with `yarn build:grammar`
- **Parser bugs**: edit `src/parser/Parser.ts`
- **Lexer bugs**: edit files in `src/lexer/`
- Tests go in `tests/`; run with `yarn test`

Before submitting a PR, ensure no regressions against the reference grammar:

```sh
yarn test
```

## Observations and known issues

- Nested lists are unsupported
- `URL` rule doesn't allow whitespace, `(`, or `)` in bare URLs
