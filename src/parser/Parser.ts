import type { Root, Paragraph, Blocks, Inlines, Plain, Emoji } from '../definitions';
import type { Token } from '../lexer';
import { TokenKind } from '../lexer';
import { TokenStream } from './TokenStream';
import type { ParserOptions } from './ParserOptions';
import {
	paragraph,
	plain,
	lineBreak,
	reducePlainTexts,
	heading,
	mentionChannel,
	code,
	codeLine,
	quote,
	bold,
	orderedList,
	unorderedList,
	listItem,
	emoji,
	emojiUnicode,
	emoticon,
	italic,
	bigEmoji,
	katex,
	inlineKatex,
	spoilerBlock,
	tasks,
	task,
	mentionUser,
	link,
	image,
	inlineCode,
	autoLink,
	autoEmail,
	phoneChecker,
	color,
	timestamp,
	timestampFromHours,
	timestampFromIsoTime,
	strike,
	spoiler,
} from '../utils';
import { scanMentionBody } from '../lexer/helpers';

/** Threaded through nested emphasis/spoiler parsers so `LINK_OPEN` honors `allowLinks` (e.g. inside link labels). */
type NestedInlineOpts = Readonly<{
	allowLinks?: boolean;
	allowAutoLinks?: boolean;
	allowMentions?: boolean;
	allowTimestamp?: boolean;
}>;

// Safety guard against runaway recursion.
const MAX_DEPTH = 100;

export class Parser {
	private readonly _stream: TokenStream;
	private readonly _options: ParserOptions;
	private _depth = 0;
	private _skipBoldDepth = 0;
	private _strikeDepth = 0;
	private _skipItalicDepth = 0;
	private _suppressNextBlockquote = false;
	private _pendingInlines: Inlines[] = [];
	private _pendingTokens: Token[] = [];

	constructor(tokens: Token[], options: ParserOptions) {
		this._stream = new TokenStream(tokens);
		this._options = options;
	}

	parse(): Root {
		void this._options;

		const bigEmojiRoot = this._tryParseBigEmojiRoot();
		if (bigEmojiRoot !== null) {
			return bigEmojiRoot;
		}

		const blocks: Array<Paragraph | Blocks> = [];

		while (!this._stream.isEOF()) {
			if (this._stream.at(TokenKind.NEWLINE)) {
				const newlineCount = this._consumeNewlines();

				// Leading newlines do not produce nodes.
				if (blocks.length === 0) {
					continue;
				}

				if (this._stream.isEOF()) {
					const previous = blocks[blocks.length - 1];
					if (previous?.type === 'HEADING' && newlineCount >= 1) {
						blocks.push(lineBreak());
					}
					continue;
				}

				const previous = blocks[blocks.length - 1];
				if (previous?.type === 'SPOILER_BLOCK' && newlineCount === 1) {
					blocks.push(lineBreak());
					continue;
				}

				// Between blocks, N newlines become N-1 LINE_BREAK nodes.
				for (let index = 1; index < newlineCount; index++) {
					blocks.push(lineBreak());
				}

				continue;
			}

			// Block first, paragraph fallback second.
			const block = this._tryBlock();
			if (block !== null) {
				blocks.push(block);
				continue;
			}

			blocks.push(this.parseParagraph());
		}

		// Keep behavior consistent with the legacy parser for empty input.
		if (blocks.length === 0) {
			blocks.push(paragraph([plain('')]));
		}

		return blocks as Root;
	}

	private _tryBlock(): Blocks | null {
		if (!this._stream.isLineStart()) {
			return null;
		}

		if (this._suppressNextBlockquote && this._stream.at(TokenKind.BLOCKQUOTE_MARKER)) {
			if (this._isEmptyBlockquoteLine()) {
				this._suppressNextBlockquote = false;
				return null;
			}
			this._suppressNextBlockquote = false;
		} else {
			this._suppressNextBlockquote = false;
		}

		if (this._stream.at(TokenKind.TRIPLE_BACKTICK)) {
			return this._parseCodeFence();
		}

		if (this._stream.at(TokenKind.KATEX_BLOCK_START)) {
			return this._parseKatexBlock();
		}

		if (this._stream.at(TokenKind.BLOCK_SPOILER_FENCE)) {
			return this._parseSpoilerBlock();
		}

		if (this._stream.at(TokenKind.BLOCKQUOTE_MARKER)) {
			return this._parseBlockquote();
		}

		if (this._stream.at(TokenKind.OL_BULLET)) {
			return this._parseOrderedList();
		}

		if (this._stream.at(TokenKind.TASK_BULLET)) {
			return this._parseTasks();
		}

		if (this._stream.at(TokenKind.UL_BULLET)) {
			return this._parseUnorderedList();
		}

		if (this._stream.at(TokenKind.HEADING_MARKER)) {
			return this._parseHeading();
		}

		return null;
	}

	private _parseHeading(): Blocks {
		const marker = this._stream.expect(TokenKind.HEADING_MARKER);

		if (this._stream.at(TokenKind.WHITESPACE)) {
			this._stream.advance();
		}

		const content = this._parsePlainTexts(new Set([TokenKind.NEWLINE, TokenKind.EOF]));

		return heading(content, Number(marker.value) as 1 | 2 | 3 | 4);
	}

	private _parseCodeFence(): Blocks | null {
		const start = this._stream.mark();
		this._stream.advance();

		if (!this._stream.at(TokenKind.CODE_CONTENT)) {
			this._stream.reset(start);
			return null;
		}

		const content = this._stream.advance().value;

		let language: string | undefined;
		let body = content;
		const firstNewline = content.indexOf('\n');

		if (firstNewline !== -1) {
			const languageCandidate = content.slice(0, firstNewline).trim();
			language = languageCandidate.length > 0 ? languageCandidate : undefined;
			body = content.slice(firstNewline + 1);
		}

		if (body.endsWith('\n')) {
			body = body.slice(0, -1);
		}

		const lines = body.split('\n').map((line) => codeLine(plain(line)));

		if (this._stream.at(TokenKind.TRIPLE_BACKTICK)) {
			this._stream.advance();
		}

		return code(lines, language);
	}

	private _parseKatexBlock(): Blocks {
		this._stream.advance();
		let content = '';

		while (!this._stream.isEOF() && !this._stream.at(TokenKind.KATEX_BLOCK_END)) {
			content += this._stream.advance().raw;
		}

		if (this._stream.at(TokenKind.KATEX_BLOCK_END)) {
			this._stream.advance();
		}

		return katex(content);
	}

	private _parseSpoilerBlock(): Blocks {
		this._stream.advance();

		if (this._stream.at(TokenKind.NEWLINE)) {
			this._stream.advance();
		}

		const paragraphs: Paragraph[] = [];

		while (!this._stream.isEOF()) {
			if (this._stream.isLineStart() && this._stream.at(TokenKind.BLOCK_SPOILER_FENCE)) {
				this._stream.advance();
				break;
			}

			const inlines = this.parseInlines(new Set([TokenKind.NEWLINE, TokenKind.EOF]));
			paragraphs.push(paragraph(inlines.length > 0 ? reducePlainTexts(inlines) : [plain('')]));

			if (this._stream.at(TokenKind.NEWLINE)) {
				this._stream.advance();
			}
		}

		if (paragraphs.length === 0) {
			paragraphs.push(paragraph([plain('')]));
		}

		return spoilerBlock(paragraphs);
	}

	private _parseBlockquote(): Blocks {
		const paragraphs: Paragraph[] = [];

		while (this._stream.isLineStart() && this._stream.at(TokenKind.BLOCKQUOTE_MARKER)) {
			this._stream.advance();

			if (this._stream.at(TokenKind.WHITESPACE)) {
				this._stream.advance();
			}

			const inlines = this.parseInlines(new Set([TokenKind.NEWLINE, TokenKind.EOF]));
			paragraphs.push(paragraph(inlines.length > 0 ? reducePlainTexts(inlines) : [plain('')]));

			if (this._stream.at(TokenKind.NEWLINE)) {
				this._stream.advance();
			}
		}

		return quote(paragraphs);
	}

	private _parseOrderedList(): Blocks {
		const items = [] as ReturnType<typeof listItem>[];

		while (this._stream.isLineStart() && this._stream.at(TokenKind.OL_BULLET)) {
			const bullet = this._stream.advance();
			const number = Number.parseInt(bullet.value, 10);
			const inlines = this.parseInlines(new Set([TokenKind.NEWLINE, TokenKind.EOF]));
			items.push(listItem(inlines.length > 0 ? reducePlainTexts(inlines) : [plain('')], number));

			const newlineMark = this._stream.mark();
			if (this._stream.at(TokenKind.NEWLINE)) {
				this._stream.advance();
			}

			if (!(this._stream.isLineStart() && this._stream.at(TokenKind.OL_BULLET))) {
				this._stream.reset(newlineMark);
				break;
			}
		}

		return orderedList(items);
	}

	private _parseUnorderedList(): Blocks {
		const items = [] as ReturnType<typeof listItem>[];
		const marker = this._stream.peek().value;

		while (this._stream.isLineStart() && this._stream.at(TokenKind.UL_BULLET) && this._stream.peek().value === marker) {
			this._stream.advance();
			const inlines = this.parseInlines(new Set([TokenKind.NEWLINE, TokenKind.EOF]));
			items.push(listItem(inlines.length > 0 ? reducePlainTexts(inlines) : [plain('')]));

			const newlineMark = this._stream.mark();
			if (this._stream.at(TokenKind.NEWLINE)) {
				this._stream.advance();
			}

			if (!(this._stream.isLineStart() && this._stream.at(TokenKind.UL_BULLET) && this._stream.peek().value === marker)) {
				this._stream.reset(newlineMark);
				break;
			}
		}

		return unorderedList(items);
	}

	private _parseTasks(): Blocks {
		const items = [] as ReturnType<typeof task>[];

		while (this._stream.isLineStart() && this._stream.at(TokenKind.TASK_BULLET)) {
			const bullet = this._stream.advance();
			const checked = bullet.value === 'x';
			const inlines = this.parseInlines(new Set([TokenKind.NEWLINE, TokenKind.EOF]));
			items.push(task(inlines.length > 0 ? reducePlainTexts(inlines) : [plain('')], checked));

			const newlineMark = this._stream.mark();
			if (this._stream.at(TokenKind.NEWLINE)) {
				this._stream.advance();
			}

			if (!(this._stream.isLineStart() && this._stream.at(TokenKind.TASK_BULLET))) {
				this._stream.reset(newlineMark);
				break;
			}
		}

		return tasks(items);
	}

	private parseParagraph(): Paragraph {
		const inlines = this.parseInlines(new Set([TokenKind.NEWLINE, TokenKind.EOF]));

		if (inlines.length === 0) {
			return paragraph([plain('')]);
		}

		return paragraph(reducePlainTexts(inlines));
	}

	private parseInlines(stopKinds: ReadonlySet<TokenKind>, options: NestedInlineOpts = {}): Inlines[] {
		const inlines: Inlines[] = [];
		const allowLinks = options.allowLinks ?? true;
		const allowAutoLinks = options.allowAutoLinks ?? true;
		const allowMentions = options.allowMentions ?? true;
		const allowTimestamp = options.allowTimestamp ?? true;

		while (
			!this._stream.isEOF() ||
			this._pendingInlines.length > 0 ||
			this._pendingTokens.length > 0
		) {
			if (this._pendingInlines.length > 0) {
				inlines.push(this._pendingInlines.shift() as Inlines);
				continue;
			}

			const token = this._peekToken();
			if (stopKinds.has(token.kind)) {
				break;
			}

			switch (token.kind) {
				case TokenKind.KATEX_INLINE_START: {
					const parsedInlineKatex = this._parseInlineKatex(stopKinds);
					if (parsedInlineKatex !== null) {
						inlines.push(parsedInlineKatex);
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.ASTERISK: {
					const starTok = this._peekToken();
					if (starTok.value === '**') {
						const t1 = this._peekToken(1);
						const t2 = this._peekToken(2);
						if (
							t1.kind === TokenKind.TEXT &&
							t2.kind === TokenKind.ASTERISK &&
							t2.value === '*'
						) {
							this._advanceToken();
							inlines.push(plain('*'));
							this._pushTokenFront({
								kind: TokenKind.ASTERISK,
								raw: '*',
								value: '*',
								start: starTok.start + 1,
								end: starTok.start + 2,
							});
							break;
						}
					}

					if (starTok.value === '***') {
						this._advanceToken();
						inlines.push(plain('*'));
						this._pushTokenFront({
							kind: TokenKind.ASTERISK,
							raw: '**',
							value: '**',
							start: starTok.start + 1,
							end: starTok.start + 3,
						});
						break;
					}

					const parsedBold = this._parseAsteriskBold(stopKinds, options);
					if (parsedBold !== null) {
						inlines.push(parsedBold);
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.UNDERSCORE: {
					const underTok = this._peekToken();
					if (underTok.value === '___') {
						this._advanceToken();
						inlines.push(plain('_'));
						this._pushTokenFront({
							kind: TokenKind.UNDERSCORE,
							raw: '__',
							value: '__',
							start: underTok.start + 1,
							end: underTok.start + 3,
						});
						break;
					}

					if (
						underTok.value === '__' &&
						this._peekToken(1).kind === TokenKind.WHITESPACE &&
						this._peekToken(2).kind === TokenKind.UNDERSCORE
					) {
						const third = this._peekToken(2);
						const fourth = this._peekToken(3);
						const looksLikeItalicContinuation =
							third.value === '__' &&
							fourth.kind === TokenKind.TEXT &&
							/^[a-zA-Z0-9]/.test(fourth.value);

						if (
							!looksLikeItalicContinuation &&
							(third.value === '_' || third.value === '__')
						) {
							this._advanceToken();
							const wsTok = this._advanceToken();
							const tailUnderTok = this._advanceToken();
							inlines.push(plain('__'));
							inlines.push(plain(wsTok.value));
							inlines.push(plain(tailUnderTok.raw));
							break;
						}
					}

					if (
						underTok.value === '__' &&
						this._doubleUnderscoreItalicWouldCloseBeforeTrailingWord() &&
						!this._doubleUnderscoreItalicPrevEndsWithWordChar()
					) {
						this._consumePegBrokenDoubleUnderscorePlain(stopKinds, inlines);
						break;
					}

					const parsedItalic = this._parseUnderscoreItalic(stopKinds, options);
					if (parsedItalic !== null) {
						inlines.push(parsedItalic);
						break;
					}

					if (underTok.value === '__' && !this._doubleUnderscoreItalicPrevEndsWithWordChar()) {
						const letterAfter = this._peekToken(1);
						if (
							letterAfter.kind === TokenKind.TEXT &&
							/^[A-Za-z]/.test(letterAfter.value)
						) {
							const mark = this._stream.mark();
							this._advanceToken();
							this._pushTokenFront({
								kind: TokenKind.UNDERSCORE,
								raw: '_',
								value: '_',
								start: underTok.start + 1,
								end: underTok.start + 2,
							});
							const retryItalic = this._parseUnderscoreItalic(stopKinds, options);
							if (retryItalic !== null) {
								inlines.push(plain('_'));
								inlines.push(retryItalic);
								break;
							}
							this._stream.reset(mark);
						}
					}

					if (
						underTok.value === '__' &&
						!this._doubleUnderscoreItalicPrevEndsWithWordChar() &&
						this._peekToken(1).kind !== TokenKind.TEXT
					) {
						this._advanceToken();
						this._pushTokenFront({
							kind: TokenKind.UNDERSCORE,
							raw: '_',
							value: '_',
							start: underTok.start + 1,
							end: underTok.start + 2,
						});
						inlines.push(plain('_'));
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.TILDE: {
					const tildeTok = this._peekToken();
					if (tildeTok.value === '~~~') {
						this._advanceToken();
						inlines.push(plain('~'));
						this._pushTokenFront({
							kind: TokenKind.TILDE,
							raw: '~~',
							value: '~~',
							start: tildeTok.start + 1,
							end: tildeTok.start + 3,
						});
						break;
					}

					const parsedStrike = this._parseTildeStrike(stopKinds, options);
					if (parsedStrike !== null) {
						inlines.push(parsedStrike);
						break;
					}

					if (tildeTok.value === '~~') {
						const ahead = this._peekToken(1);
						if (
							ahead.kind === TokenKind.EOF ||
							ahead.kind === TokenKind.NEWLINE ||
							ahead.kind === TokenKind.WHITESPACE
						) {
							this._advanceToken();
							inlines.push(plain('~~'));
							break;
						}

						this._advanceToken();
						inlines.push(plain('~'));
						this._pushTokenFront({
							kind: TokenKind.TILDE,
							raw: '~',
							value: '~',
							start: tildeTok.start + 1,
							end: tildeTok.start + 2,
						});
						break;
					}

					this._advanceToken();
					inlines.push(plain(tildeTok.raw));
					break;
				}

				case TokenKind.BACKTICK: {
					const parsedInlineCode = this._parseInlineCode(stopKinds);
					if (parsedInlineCode !== null) {
						inlines.push(parsedInlineCode);
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.SPOILER_FENCE: {
					const parsedSpoiler = this._parseInlineSpoiler(stopKinds, options);
					if (parsedSpoiler !== null) {
						inlines.push(parsedSpoiler);
						break;
					}

					this._advanceToken();
					inlines.push(plain('||'));
					break;
				}

				case TokenKind.TEXT:
					this._advanceToken();
					for (const node of this._consumeTextWithImplicitMentions(token)) {
						inlines.push(node);
					}
					break;

				case TokenKind.WHITESPACE:
				case TokenKind.ESCAPED:
					this._advanceToken();
					inlines.push(plain(token.value));
					break;

				case TokenKind.MENTION_CHANNEL: {
					const prevToken = this._stream.peek(-1);
					this._advanceToken();
					if (!allowMentions || !this._canEmitMention(token, prevToken)) {
						inlines.push(plain(token.raw));
						break;
					}
					inlines.push(mentionChannel(token.value));
					break;
				}

				case TokenKind.MENTION_USER: {
					const prevToken = this._stream.peek(-1);
					if (!allowMentions || !this._canEmitMention(token, prevToken)) {
						const promoted = allowMentions && this._tryPromoteMentionToEmail(inlines, token);
						if (!promoted) {
							this._advanceToken();
							inlines.push(plain(token.raw));
						}
						break;
					}
					this._advanceToken();
					inlines.push(mentionUser(token.value));
					break;
				}

				case TokenKind.URL: {
					if (!allowAutoLinks || !this._shouldAutoLinkUrl(this._stream.peek(-1))) {
						this._advanceToken();
						inlines.push(plain(token.raw));
						break;
					}

					const schemeIndex = token.value.indexOf('://');
					if (schemeIndex > 0) {
						const scheme = token.value.slice(0, schemeIndex);
						if (scheme.includes('...')) {
							this._advanceToken();
							inlines.push(plain(token.raw));
							break;
						}
					}

					let urlValue = token.value;
					const next = this._peekToken(1);
					if (next.kind === TokenKind.MENTION_USER && next.start === token.end) {
						const candidate = `${token.value}${next.raw}`;
						this._advanceToken();
						this._advanceToken();
						const emailValue = candidate.startsWith('mailto:') ? candidate.slice(7) : candidate;
						inlines.push(autoEmail(emailValue));
						break;
					}

					if (next.kind === TokenKind.TEXT && next.start === token.end) {
						if (next.value.startsWith('?') || (token.value.includes('(') && next.value.startsWith(')'))) {
							urlValue += next.value;
							this._advanceToken();
							this._advanceToken();
							inlines.push(autoLink(urlValue, this._options.customDomains));
							break;
						}
					}

					if (next.kind === TokenKind.TEXT && /^:\d+/.test(next.value)) {
						urlValue += next.value;
						this._advanceToken();
						this._advanceToken();
						inlines.push(autoLink(urlValue, this._options.customDomains));
						break;
					}

					this._advanceToken();
					inlines.push(autoLink(urlValue, this._options.customDomains));
					break;
				}

				case TokenKind.EMAIL: {
					if (!allowAutoLinks) {
						this._advanceToken();
						inlines.push(plain(token.raw));
						break;
					}

					this._advanceToken();
					const emailValue = token.value.startsWith('mailto:') ? token.value.slice(7) : token.value;
					inlines.push(autoEmail(emailValue));
					break;
				}

				case TokenKind.PHONE: {
					if (!allowAutoLinks || !this._canAutoLinkPhone(this._stream.peek(-1))) {
						this._advanceToken();
						inlines.push(plain(token.raw));
						break;
					}

					this._advanceToken();
					const split = this._splitPhoneToken(token);
					inlines.push(phoneChecker(split.raw, split.number));
					if (split.trailing.length > 0) {
						inlines.push(plain(split.trailing));
					}
					break;
				}

				case TokenKind.COLOR: {
					this._advanceToken();
					const parsedColor = this._parseColorToken(token.value);
					inlines.push(parsedColor ?? plain(token.raw));
					break;
				}

				case TokenKind.TIMESTAMP: {
					this._advanceToken();
					if (!allowTimestamp) {
						inlines.push(plain(token.raw));
						break;
					}

					const parsedTimestamp = this._parseTimestampToken(token.value, token.raw);
					inlines.push(parsedTimestamp ?? plain(token.raw));
					break;
				}

				case TokenKind.LINK_OPEN: {
					if (!allowLinks) {
						this._advanceToken();
						inlines.push(plain(token.raw));
						break;
					}

					const parsedLink = this._parseMarkdownLink(stopKinds);
					if (parsedLink !== null) {
						inlines.push(parsedLink);
						break;
					}
					const bracketPlain = this._consumeBracketedPlain(stopKinds);
					if (bracketPlain !== null) {
						inlines.push(plain(bracketPlain));
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.IMAGE_OPEN: {
					if (!allowLinks) {
						this._advanceToken();
						inlines.push(plain(token.raw));
						break;
					}

					const parsedImage = this._parseMarkdownImage(stopKinds);
					if (parsedImage !== null) {
						inlines.push(parsedImage);
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.ANGLE_OPEN: {
					if (!allowLinks) {
						this._advanceToken();
						inlines.push(plain(token.raw));
						break;
					}

					const parsedAngleLink = this._parseAngleLink(stopKinds);
					if (parsedAngleLink !== null) {
						inlines.push(parsedAngleLink);
						break;
					}
					const plainAngle = this._consumeAnglePlain(stopKinds);
					if (plainAngle !== null) {
						inlines.push(plain(plainAngle));
						break;
					}

					this._advanceToken();
					inlines.push(plain(token.raw));
					break;
				}

				case TokenKind.EMOJI_SHORTCODE:
					this._advanceToken();
					inlines.push(emoji(token.value));
					break;

				case TokenKind.EMOJI_UNICODE:
					this._advanceToken();
					inlines.push(emojiUnicode(token.value));
					break;

				case TokenKind.EMOTICON:
					{
						const next = this._peekToken(1);
						const nextStartsWord = next.kind === TokenKind.TEXT && /^[A-Za-z0-9]/.test(next.value);
						if (token.raw === '-_-' && (nextStartsWord || next.kind === TokenKind.UNDERSCORE)) {
							this._advanceToken();
							inlines.push(plain('-'));
							this._pushTokenFront({
								kind: TokenKind.TEXT,
								raw: '-',
								value: '-',
								start: token.start + 2,
								end: token.start + 3,
							});
							this._pushTokenFront({
								kind: TokenKind.UNDERSCORE,
								raw: '_',
								value: '_',
								start: token.start + 1,
								end: token.start + 2,
							});
							break;
						}

						this._advanceToken();
						inlines.push(emoticon(token.raw, token.value));
						break;
					}
					break;

				default:
					this._advanceToken();
					inlines.push(plain(token.raw));
			}
		}

		return inlines;
	}

	private _tryParseBigEmojiRoot(): Root | null {
		const start = this._stream.mark();
		const emojis: Emoji[] = [];

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();

			switch (token.kind) {
				case TokenKind.EMOJI_SHORTCODE:
					this._stream.advance();
					emojis.push(emoji(token.value));
					break;

				case TokenKind.EMOJI_UNICODE:
					this._stream.advance();
					emojis.push(emojiUnicode(token.value));
					break;

				case TokenKind.EMOTICON:
					this._stream.advance();
					emojis.push(emoticon(token.raw, token.value));
					break;

				case TokenKind.WHITESPACE:
				case TokenKind.NEWLINE:
					this._stream.advance();
					break;

				default:
					this._stream.reset(start);
					return null;
			}
		}

		if (emojis.length >= 1 && emojis.length <= 3) {
			return [bigEmoji(emojis as [Emoji] | [Emoji, Emoji] | [Emoji, Emoji, Emoji])];
		}

		this._stream.reset(start);
		return null;
	}

	private _parseInlineKatex(stopKinds: ReadonlySet<TokenKind>): Inlines | null {
		const start = this._stream.mark();

		if (!this._stream.at(TokenKind.KATEX_INLINE_START)) {
			return null;
		}

		this._stream.advance();
		let content = '';

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();

			if (token.kind === TokenKind.KATEX_INLINE_END) {
				this._stream.advance();
				return inlineKatex(content);
			}

			if (stopKinds.has(token.kind)) {
				this._stream.reset(start);
				return null;
			}

			content += this._stream.advance().raw;
		}

		this._stream.reset(start);
		return null;
	}

	private _parseInlineCode(stopKinds: ReadonlySet<TokenKind>): Inlines | null {
		const start = this._stream.mark();

		if (!this._stream.at(TokenKind.BACKTICK)) {
			return null;
		}

		this._stream.advance();
		let content = '';

		if (this._stream.at(TokenKind.CODE_CONTENT)) {
			content = this._stream.advance().value;
		}

		if (this._stream.at(TokenKind.BACKTICK)) {
			this._stream.advance();
			return inlineCode(plain(content));
		}

		if (stopKinds.has(this._stream.peek().kind)) {
			this._stream.reset(start);
			return null;
		}

		this._stream.reset(start);
		return null;
	}

	private _parseAsteriskBold(stopKinds: ReadonlySet<TokenKind>, inlineOpts: NestedInlineOpts = {}): Inlines | null {
		if (this._skipBoldDepth > 0) {
			return null;
		}

		const start = this._stream.mark();
		const opener = this._peekToken();

		if (opener.kind !== TokenKind.ASTERISK || (opener.value !== '*' && opener.value !== '**')) {
			return null;
		}

		const delimiter = opener.value;
		this._skipBoldDepth++;

		try {
			this._advanceToken();
			const content: Inlines[] = [];

			while (!this._stream.isEOF() || this._pendingTokens.length > 0) {
				const token = this._peekToken();

				if (stopKinds.has(token.kind)) {
					this._resetInlineState(start);
					return null;
				}

				if (token.kind === TokenKind.ASTERISK) {
				if (token.value === delimiter) {
					this._advanceToken();
					const reduced = reducePlainTexts(content);
					return this._finishEmphasis(start, reduced, 'bold');
				}

				if (delimiter === '*' && token.value === '**') {
					this._advanceToken();
					this._pushTokenFront({
						...token,
						raw: '*',
						value: '*',
						start: token.start + 1,
						end: token.start + 2,
					});
					const reduced = reducePlainTexts(content);
					return this._finishEmphasis(start, reduced, 'bold');
				}
			}

			if (token.kind === TokenKind.ASTERISK) {
				const nestedBold = this._parseAsteriskBold(stopKinds, inlineOpts);
				if (nestedBold !== null) {
					content.push(nestedBold);
					continue;
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const saved1 = this._pendingTokens.slice();
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
				this._pendingTokens = saved1;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			if (token.kind === TokenKind.ASTERISK) {
				const nestedBold = this._parseAsteriskBold(stopKinds, inlineOpts);
				if (nestedBold !== null) {
					content.push(nestedBold);
					continue;
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const savedPendingCopy = this._pendingTokens.slice();
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
				this._pendingTokens = savedPendingCopy;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			if (token.kind === TokenKind.ASTERISK) {
				const nestedBold = this._parseAsteriskBold(stopKinds, inlineOpts);
				if (nestedBold !== null) {
					content.push(nestedBold);
					continue;
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const savedPendingCopy = this._pendingTokens.slice();
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
				this._pendingTokens = savedPendingCopy;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}
				if (delimiter === '**' && token.value === '***') {
					this._advanceToken();
					this._pushTokenFront({
						kind: TokenKind.ASTERISK,
						raw: '*',
						value: '*',
						start: token.start + 2,
						end: token.start + 3,
					});
					const reduced = reducePlainTexts(content);
					return this._finishEmphasis(start, reduced, 'bold');
				}

				if (delimiter === '**' && token.value === '****') {
					this._advanceToken();
					this._pushTokenFront({
						kind: TokenKind.ASTERISK,
						raw: '**',
						value: '**',
						start: token.start + 2,
						end: token.start + 4,
					});
					const reduced = reducePlainTexts(content);
					return this._finishEmphasis(start, reduced, 'bold');
				}

			if (token.kind === TokenKind.EMOTICON && delimiter === '*' && token.raw.endsWith('*')) {
				const prefix = token.raw.slice(0, -1);
				const prevChar = this._lastContentChar(content);
				const next = this._peekToken(1);
				const nextStartsWord = next.kind === TokenKind.TEXT && /^[A-Za-z0-9]/.test(next.value);
				const prevIsWhitespace = prevChar === undefined || /\s/.test(prevChar);
				const shouldClose = (!prevIsWhitespace || nextStartsWord) && prefix.length > 0;
				if (shouldClose) {
					content.push(plain(prefix));
					this._advanceToken();
					const reduced = reducePlainTexts(content);
					return this._finishEmphasis(start, reduced, 'bold');
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const nestedItalic = this._parseUnderscoreItalic(stopKinds, inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}

				if (token.value === '__') {
					const prevWord = this._doubleUnderscoreItalicPrevEndsWithWordChar();
					const peek1 = this._peekToken(1);
					if (
						!prevWord &&
						peek1.kind !== TokenKind.TEXT
					) {
						this._advanceToken();
						this._pushTokenFront({
							kind: TokenKind.UNDERSCORE,
							raw: '_',
							value: '_',
							start: token.start + 1,
							end: token.start + 2,
						});
						content.push(plain('_'));
						continue;
					}
				}
			}

			if (token.kind === TokenKind.TILDE) {
					const strikeStopKinds = new Set([...stopKinds].filter(k => k !== TokenKind.UNDERSCORE && k !== TokenKind.TILDE));
					const nestedStrike = this._parseTildeStrike(strikeStopKinds, inlineOpts);
					if (nestedStrike !== null) {
						content.push(nestedStrike);
						continue;
					}
				}

				if (token.kind === TokenKind.ASTERISK) {
					const boldStopKinds = delimiter === '__' ? stopKinds : new Set([...stopKinds, TokenKind.UNDERSCORE]);
					const nestedBold = this._parseAsteriskBold(boldStopKinds, inlineOpts);
					if (nestedBold !== null) {
						content.push(nestedBold);
						continue;
					}
				}

				if (token.kind === TokenKind.TILDE) {
					const strikeStopKinds = new Set([...stopKinds].filter(k => k !== TokenKind.UNDERSCORE && k !== TokenKind.TILDE));
					const nestedStrike = this._parseTildeStrike(strikeStopKinds, inlineOpts);
					if (nestedStrike !== null) {
						content.push(nestedStrike);
						content.push(nestedStrike);
						continue;
					}
				}

			if (token.kind === TokenKind.UNDERSCORE) {
				const savedUnderscorePending = [...this._pendingTokens];
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
			this._pendingTokens = savedUnderscorePending;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			this._advanceToken();
			switch (token.kind) {
				case TokenKind.TEXT:
					for (const node of this._consumeTextWithImplicitMentions(token)) {
						content.push(node);
					}
					break;
				case TokenKind.WHITESPACE:
				case TokenKind.ESCAPED:
					content.push(plain(token.value));
					break;
				case TokenKind.MENTION_CHANNEL:
					content.push(mentionChannel(token.value));
					break;
				case TokenKind.MENTION_USER:
					content.push(mentionUser(token.value));
					break;
				case TokenKind.EMOJI_SHORTCODE:
					content.push(emoji(token.value));
					break;
				case TokenKind.EMOJI_UNICODE:
					content.push(emojiUnicode(token.value));
					break;
				case TokenKind.EMOTICON:
					content.push(emoticon(token.raw, token.value));
					break;
				case TokenKind.TIMESTAMP:
					content.push(plain(token.raw));
					break;
				default:
					content.push(plain(token.raw));
			}
		}

		this._resetInlineState(start);
		return null;
		} finally {
			this._skipBoldDepth--;
		}
	}

	private _parseUnderscoreItalic(stopKinds: ReadonlySet<TokenKind>, inlineOpts: NestedInlineOpts = {}): Inlines | null {
		const start = this._stream.mark();
		const opener = this._peekToken();

		if (opener.kind !== TokenKind.UNDERSCORE || (opener.value !== '_' && opener.value !== '__')) {
			return null;
		}

		if (this._skipItalicDepth > 0) {
			return null;
		}

		if (opener.value === '_' && this._skipBoldDepth === 0 && !this._canUnderscoreOpenEmphasis()) {
			return null;
		}

		if (opener.value === '_' && this._isSnakeUnderscoreEmphasisTrap()) {
			return null;
		}

		if (opener.value === '__' && this._doubleUnderscoreItalicPrevEndsWithWordChar()) {
			return null;
		}

		if (
			opener.value === '__' &&
			this._doubleUnderscoreItalicWouldCloseBeforeTrailingWord() &&
			!this._doubleUnderscoreItalicPrevEndsWithWordChar()
		) {
			return null;
		}

		if (opener.value === '_') {
			const afterUnderscore = this._peekToken(1);
			if (
				afterUnderscore.kind === TokenKind.TEXT &&
				afterUnderscore.value.charCodeAt(0) === 64
			) {
				return null;
			}

			if (afterUnderscore.kind === TokenKind.MENTION_USER) {
				return null;
			}
		}

		const rawBefore = this._stream.peek(-1).raw ?? '';
		if (rawBefore.endsWith('-') && this._peekToken(1).kind === TokenKind.EMOTICON) {
			return null;
		}

		const delimiter = opener.value;

		this._skipItalicDepth++;

		this._advanceToken();
		const content: Inlines[] = [];

		try {
			while (!this._stream.isEOF() || this._pendingTokens.length > 0) {
				const token = this._peekToken();

				if (stopKinds.has(token.kind) && token.kind !== TokenKind.TILDE) {
					this._resetInlineState(start);
					return null;
				}

				if (token.kind === TokenKind.UNDERSCORE) {
					if (token.value === delimiter) {
						if (delimiter === '_') {
							const nextTok = this._peekToken(1);
							if (nextTok.kind === TokenKind.TEXT && /^[a-zA-Z]/.test(nextTok.value)) {
								const hasNonPlain = content.some(n => n.type !== 'PLAIN_TEXT');
								if (!hasNonPlain) {
									this._advanceToken();
									let trailing = '';
									while (!this._stream.isEOF()) {
										const t = this._peekToken();
										if (t.kind === TokenKind.TEXT) {
											const m = t.value.match(/^[a-zA-Z]+/);
											if (m) {
												trailing += m[0];
												this._advanceToken();
												if (m[0].length < t.value.length) {
													this._pushTokenFront({
														...t,
														raw: t.raw.slice(m[0].length),
														value: t.value.slice(m[0].length),
														start: t.start + m[0].length,
													});
												}
												continue;
											}
										}
										break;
									}
									const merged = reducePlainTexts([plain('_'), ...content, plain('_'), plain(trailing)]);
									return merged.length === 1 ? merged[0] : plain(merged.map(n => n.type === 'PLAIN_TEXT' ? n.value : '').join(''));
								}
								this._resetInlineState(start);
								return null;
							}
						}

						this._advanceToken();
						const reduced = reducePlainTexts(content);
						return this._finishEmphasis(start, reduced, 'italic');
					}

					if (delimiter === '_' && token.value === '__') {
						this._advanceToken();
						this._pushTokenFront({
							...token,
							raw: '_',
							value: '_',
							start: token.start + 1,
							end: token.start + 2,
						});
						const reduced = reducePlainTexts(content);
						return this._finishEmphasis(start, reduced, 'italic');
					}

					if (delimiter === '__' && token.value === '___') {
						this._advanceToken();
						this._pushTokenFront({
							kind: TokenKind.UNDERSCORE,
							raw: '_',
							value: '_',
							start: token.start + 2,
							end: token.start + 3,
						});
						const reduced = reducePlainTexts(content);
						return this._finishEmphasis(start, reduced, 'italic');
					}
				}

				if (token.kind === TokenKind.EMOTICON && delimiter === '_' && token.raw.includes('_')) {
					const prevChar = this._lastContentChar(content);
					const next = this._peekToken(1);
					const prevIsWhitespace = prevChar === undefined || /\s/.test(prevChar);
					const nextStartsWord = next.kind === TokenKind.TEXT && /^[A-Za-z0-9]/.test(next.value);
					if (!prevIsWhitespace || nextStartsWord) {
						const index = token.raw.indexOf('_');
						const prefix = token.raw.slice(0, index);
						const suffix = token.raw.slice(index + 1);
						if (prefix.length > 0) {
							content.push(plain(prefix));
						}
						this._advanceToken();
						const reduced = reducePlainTexts(content);
						if (suffix.length > 0) {
							this._pendingInlines.unshift(plain(suffix));
						}
						return this._finishEmphasis(start, reduced, 'italic');
					}
				}

				if (token.kind === TokenKind.ASTERISK) {
					const boldStopKinds = delimiter === '__' ? stopKinds : new Set([...stopKinds, TokenKind.UNDERSCORE]);
					const nestedBold = this._parseAsteriskBold(boldStopKinds, inlineOpts);
					if (nestedBold !== null) {
						content.push(nestedBold);
						continue;
					}
				}

				if (token.kind === TokenKind.TILDE) {
					const strikeStopKinds = new Set([...stopKinds].filter(k => k !== TokenKind.UNDERSCORE && k !== TokenKind.TILDE));
					const nestedStrike = this._parseTildeStrike(strikeStopKinds, inlineOpts);
					if (nestedStrike !== null) {
						content.push(nestedStrike);
						continue;
					}
				}

			if (token.kind === TokenKind.UNDERSCORE) {
				const savedUnderscorePending = [...this._pendingTokens];
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
			this._pendingTokens = savedUnderscorePending;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			if (token.kind === TokenKind.ASTERISK) {
				const nestedBold = this._parseAsteriskBold(stopKinds, inlineOpts);
				if (nestedBold !== null) {
					content.push(nestedBold);
					continue;
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const saved2 = [...this._pendingTokens];
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
				this._pendingTokens = saved2;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			if (token.kind === TokenKind.ASTERISK) {
				const nestedBold = this._parseAsteriskBold(stopKinds, inlineOpts);
				if (nestedBold !== null) {
					content.push(nestedBold);
					continue;
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const saved3 = [...this._pendingTokens];
				const nestedItalic = this._parseUnderscoreItalic(new Set([...stopKinds, TokenKind.UNDERSCORE]), inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
				this._pendingTokens = saved3;
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			this._advanceToken();
			switch (token.kind) {
				case TokenKind.TEXT:
					for (const node of this._consumeTextWithImplicitMentions(token)) {
						content.push(node);
					}
					break;
				case TokenKind.WHITESPACE:
				case TokenKind.ESCAPED:
					content.push(plain(token.value));
					break;
				case TokenKind.MENTION_CHANNEL:
					content.push(mentionChannel(token.value));
					break;
				case TokenKind.MENTION_USER:
					content.push(mentionUser(token.value));
					break;
				case TokenKind.EMOJI_SHORTCODE:
					content.push(emoji(token.value));
					break;
				case TokenKind.EMOJI_UNICODE:
					content.push(emojiUnicode(token.value));
					break;
				case TokenKind.EMOTICON:
					content.push(emoticon(token.raw, token.value));
					break;
				case TokenKind.TIMESTAMP: {
					const parsedTs = this._parseTimestampToken(token.value, token.raw);
					content.push(parsedTs ?? plain(token.raw));
					break;
				}
				default:
					content.push(plain(token.raw));
			}
		}

		this._resetInlineState(start);
		return null;
	} finally {
			this._skipItalicDepth--;
		}
	}

	private _strikeCallId = 0;

	private _parseTildeStrike(stopKinds: ReadonlySet<TokenKind>, inlineOpts: NestedInlineOpts = {}): Inlines | null {
		if (this._strikeDepth > 0) {
			return null;
		}

		const start = this._stream.mark();
		const opener = this._peekToken();

		if (opener.kind !== TokenKind.TILDE || (opener.value !== '~' && opener.value !== '~~')) {
			return null;
		}

		const delimiter = opener.value;
		this._strikeDepth++;
		this._advanceToken();
		const content: Inlines[] = [];

		while (!this._stream.isEOF() || this._pendingTokens.length > 0) {
			const token = this._peekToken();

			if (stopKinds.has(token.kind)) {
					this._resetInlineState(start);
					this._strikeDepth--;
					return null;
				}

				if (token.kind === TokenKind.TILDE) {
				if (token.value === delimiter) {
					this._advanceToken();
					const reduced = reducePlainTexts(content);
					const result = this._finishEmphasis(start, reduced, 'strike');
					this._strikeDepth--;
					return result;
				}

				if (delimiter === '~' && token.value === '~~') {
					this._advanceToken();
					this._pushTokenFront({
						...token,
						raw: '~',
						value: '~',
						start: token.start + 1,
						end: token.start + 2,
					});
					const reduced = reducePlainTexts(content);
					const result = this._finishEmphasis(start, reduced, 'strike');
					this._strikeDepth--;
					return result;
				}

				if (delimiter === '~~' && token.value === '~~~') {
					this._advanceToken();
					this._pushTokenFront({
						kind: TokenKind.TILDE,
						raw: '~',
						value: '~',
						start: token.start + 2,
						end: token.start + 3,
					});
					const reduced = reducePlainTexts(content);
					const result = this._finishEmphasis(start, reduced, 'strike');
					this._strikeDepth--;
					return result;
				}
			}

			if (token.kind === TokenKind.ASTERISK) {
				const nestedBold = this._parseAsteriskBold(new Set([...stopKinds, TokenKind.TILDE]), inlineOpts);
				if (nestedBold !== null) {
					content.push(nestedBold);
					continue;
				}
			}

			if (token.kind === TokenKind.UNDERSCORE) {
				const nestedItalic = this._parseUnderscoreItalic(stopKinds, inlineOpts);
				if (nestedItalic !== null) {
					content.push(nestedItalic);
					continue;
				}
			}

			if (token.kind === TokenKind.BACKTICK) {
				const nestedCode = this._parseInlineCode(stopKinds);
				if (nestedCode !== null) {
					content.push(nestedCode);
					continue;
				}
			}

			if (token.kind === TokenKind.LINK_OPEN) {
				const allowLinks = inlineOpts.allowLinks ?? true;
				if (!allowLinks) {
					this._advanceToken();
					content.push(plain(token.raw));
					continue;
				}

				const parsedLink = this._parseMarkdownLink(stopKinds);
				if (parsedLink !== null) {
					content.push(parsedLink);
					continue;
				}
			}

			if (token.kind === TokenKind.SPOILER_FENCE) {
				const nestedSpoiler = this._parseInlineSpoiler(stopKinds, inlineOpts);
				if (nestedSpoiler !== null) {
					content.push(nestedSpoiler);
					continue;
				}
			}

			this._advanceToken();
			switch (token.kind) {
				case TokenKind.TEXT:
					for (const node of this._consumeTextWithImplicitMentions(token)) {
						content.push(node);
					}
					break;
				case TokenKind.WHITESPACE:
				case TokenKind.ESCAPED:
					content.push(plain(token.value));
					break;
				case TokenKind.MENTION_CHANNEL:
					content.push(mentionChannel(token.value));
					break;
				case TokenKind.MENTION_USER:
					content.push(mentionUser(token.value));
					break;
				case TokenKind.EMOJI_SHORTCODE:
					content.push(emoji(token.value));
					break;
				case TokenKind.EMOJI_UNICODE:
					content.push(emojiUnicode(token.value));
					break;
				case TokenKind.EMOTICON:
					content.push(emoticon(token.raw, token.value));
					break;
				case TokenKind.TIMESTAMP: {
					const parsedTs = this._parseTimestampToken(token.value, token.raw);
					content.push(parsedTs ?? plain(token.raw));
					break;
				}
				default:
					content.push(plain(token.raw));
			}
		}

		if (this._stream.isEOF()) {
			this._resetInlineState(start);
			this._strikeDepth--;
			return null;
		}
		this._resetInlineState(start);
		this._strikeDepth--;
		return null;
	}

	private _parseInlineSpoiler(stopKinds: ReadonlySet<TokenKind>, inlineOpts: NestedInlineOpts = {}): Inlines | null {
		const start = this._stream.mark();

		if (!this._stream.at(TokenKind.SPOILER_FENCE)) {
			return null;
		}

		this._stream.advance();
		const innerStop = new Set(stopKinds);
		innerStop.add(TokenKind.SPOILER_FENCE);

		const inner = this.parseInlines(innerStop, {
			allowLinks: inlineOpts.allowLinks ?? true,
			allowAutoLinks: inlineOpts.allowAutoLinks ?? true,
			allowMentions: inlineOpts.allowMentions ?? true,
			allowTimestamp: inlineOpts.allowTimestamp ?? true,
		});

		if (!this._stream.at(TokenKind.SPOILER_FENCE)) {
			this._stream.reset(start);
			return null;
		}

		this._stream.advance();
		const reduced = reducePlainTexts(inner);
		if (reduced.length === 0) {
			this._stream.reset(start);
			return null;
		}

		return spoiler(reduced as any);
	}

	private _consumeTextWithImplicitMentions(token: Token): Inlines[] {
		if (token.kind !== TokenKind.TEXT) {
			return [plain(token.value)];
		}

		const value = token.value;
		const parts: Inlines[] = [];
		let index = 0;

		while (index < value.length) {
			const atBoundary =
				index === 0 ||
				value.charCodeAt(index - 1) === 32 ||
				value.charCodeAt(index - 1) === 9 ||
				value.charCodeAt(index - 1) === 10 ||
				value.charCodeAt(index - 1) === 13;

			if (atBoundary && value.charCodeAt(index) === 35 /* # */) {
				const name = scanMentionBody(value, value.length, index + 1);
				if (name.length > 0) {
					parts.push(mentionChannel(name));
					index += 1 + name.length;
					continue;
				}
			}

			if (atBoundary && value.charCodeAt(index) === 64 /* @ */) {
				const name = scanMentionBody(value, value.length, index + 1);
				if (name.length > 0) {
					parts.push(mentionUser(name));
					index += 1 + name.length;
					continue;
				}
			}

			let boundary = index + 1;
			while (boundary < value.length) {
				const code = value.charCodeAt(boundary);
				if (code === 35 || code === 64) {
					const boundaryPrev = value.charCodeAt(boundary - 1);
					const isPrevWs =
						boundaryPrev === 32 ||
						boundaryPrev === 9 ||
						boundaryPrev === 10 ||
						boundaryPrev === 13;
					if (boundary === 0 || isPrevWs) {
						break;
					}
				}
				boundary++;
			}

			parts.push(plain(value.slice(index, boundary)));
			index = boundary;
		}

		return parts;
	}

	private _parseMarkdownLink(stopKinds: ReadonlySet<TokenKind>): Inlines | null {
		const start = this._stream.mark();

		if (!this._stream.at(TokenKind.LINK_OPEN)) {
			return null;
		}

		this._stream.advance();
		const labelStopKinds = new Set(stopKinds);
		labelStopKinds.add(TokenKind.LINK_HREF_OPEN);
		const label = this.parseInlines(labelStopKinds, {
			allowLinks: false,
			allowAutoLinks: false,
			allowMentions: false,
		});

		if (!this._stream.at(TokenKind.LINK_HREF_OPEN)) {
			this._stream.reset(start);
			return null;
		}
		if (this._labelContainsBracketSeparator(label)) {
			this._stream.reset(start);
			return null;
		}

		this._stream.advance();
		const hrefResult = this._parseLinkHref(stopKinds);
		if (hrefResult === null) {
			this._stream.reset(start);
			return null;
		}
		const { href, closed } = hrefResult;

		if (!closed) {
			this._stream.reset(start);
			return null;
		}

		if (this._stream.at(TokenKind.LINK_HREF_CLOSE)) {
			this._stream.advance();
		} else if (!hrefResult.closedImplicitly) {
			this._stream.reset(start);
			return null;
		}
		const reduced = reducePlainTexts(label);
		return reduced.length > 0 ? link(href, reduced as any) : link(href);
	}

	private _parseMarkdownImage(stopKinds: ReadonlySet<TokenKind>): Inlines | null {
		const start = this._stream.mark();

		if (!this._stream.at(TokenKind.IMAGE_OPEN)) {
			return null;
		}

		this._stream.advance();
		const labelStopKinds = new Set(stopKinds);
		labelStopKinds.add(TokenKind.LINK_HREF_OPEN);
		const label = this.parseInlines(labelStopKinds, {
			allowLinks: false,
			allowAutoLinks: false,
			allowMentions: false,
		});

		if (!this._stream.at(TokenKind.LINK_HREF_OPEN)) {
			this._stream.reset(start);
			return null;
		}

		this._stream.advance();
		const hrefResult = this._parseLinkHref(stopKinds);
		if (hrefResult === null) {
			this._stream.reset(start);
			return null;
		}
		const { href, closed } = hrefResult;

		if (!closed) {
			this._stream.reset(start);
			return null;
		}

		if (this._stream.at(TokenKind.LINK_HREF_CLOSE)) {
			this._stream.advance();
		} else if (!hrefResult.closedImplicitly) {
			this._stream.reset(start);
			return null;
		}
		const reduced = reducePlainTexts(label);
		return reduced.length > 0 ? image(href, reduced[0] as Plain) : image(href);
	}

	private _parseAngleLink(stopKinds: ReadonlySet<TokenKind>): Inlines | null {
		const start = this._stream.mark();

		if (!this._stream.at(TokenKind.ANGLE_OPEN)) {
			return null;
		}

		this._stream.advance();
		let hrefTokens: Token[] = [];
		let labelTokens: Token[] = [];
		let inLabel = false;

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();

			if (stopKinds.has(token.kind)) {
				this._stream.reset(start);
				return null;
			}

			if (token.kind === TokenKind.ANGLE_CLOSE) {
				this._stream.advance();
				const href = this._joinHrefTokens(hrefTokens);
				if (href === null || href.length === 0) {
					this._stream.reset(start);
					return null;
				}

				if (labelTokens.length === 0) {
					return link(href);
				}

				const label = this._tokensToPlain(labelTokens);
				return link(href, [label]);
			}

			if (token.kind === TokenKind.PIPE) {
				inLabel = true;
				this._stream.advance();
				continue;
			}

			this._stream.advance();
			if (inLabel) {
				labelTokens.push(token);
			} else {
				hrefTokens.push(token);
			}
		}

		this._stream.reset(start);
		return null;
	}

	private _parseLinkHref(
		stopKinds: ReadonlySet<TokenKind>,
	): { href: string; closed: boolean; closedImplicitly: boolean } | null {
		const tokens: Token[] = [];
		let parenDepth = 0;
		const allowImplicitClose = stopKinds.has(TokenKind.LINK_HREF_CLOSE);

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();

			if (token.kind === TokenKind.LINK_HREF_CLOSE) {
				if (parenDepth === 0) {
					return {
						href: this._joinHrefTokens(tokens),
						closed: true,
						closedImplicitly: false,
					};
				}
				this._stream.advance();
				parenDepth = Math.max(0, parenDepth - 1);
				tokens.push(token);
				continue;
			}

			if (stopKinds.has(token.kind)) {
				if (allowImplicitClose && (token.kind as TokenKind) === TokenKind.LINK_HREF_CLOSE) {
					return {
						href: this._joinHrefTokens(tokens),
						closed: true,
						closedImplicitly: true,
					};
				}
				return null;
			}

			const value = token.value ?? '';
			const hasOpen = value.includes('(');
			const hasClose = value.includes(')');
			const canCloseImplicitly =
				parenDepth === 0 &&
				!hasOpen &&
				hasClose &&
				token.kind !== TokenKind.PHONE;

			if (canCloseImplicitly) {
				const closeIndex = value.indexOf(')');
				const before = value.slice(0, closeIndex);
				if (before.length > 0) {
					tokens.push({
						kind: TokenKind.TEXT,
						raw: before,
						value: before,
						start: token.start,
						end: token.start + before.length,
					});
				}
				this._stream.advance();
				return {
					href: this._joinHrefTokens(tokens),
					closed: true,
					closedImplicitly: true,
				};
			}

			this._stream.advance();
			tokens.push(token);
			parenDepth = Math.max(0, parenDepth + this._countParens(value));
		}

		return {
			href: this._joinHrefTokens(tokens),
			closed: false,
			closedImplicitly: false,
		};
	}

	private _canAutoLinkPhone(prev: Token): boolean {
		if (!prev || prev.kind === TokenKind.EOF) {
			return true;
		}
		return prev.kind === TokenKind.WHITESPACE || prev.kind === TokenKind.NEWLINE;
	}

	private _shouldAutoLinkUrl(prev: Token): boolean {
		if (!prev || prev.kind === TokenKind.EOF) {
			return true;
		}
		if (prev.kind === TokenKind.WHITESPACE || prev.kind === TokenKind.NEWLINE) {
			return true;
		}
		return false;
	}

	private _peekToken(offset = 0): Token {
		if (offset < 0) {
			return this._stream.peek(offset);
		}
		if (offset < this._pendingTokens.length) {
			return this._pendingTokens[offset];
		}
		return this._stream.peek(offset - this._pendingTokens.length);
	}

	private _advanceToken(): Token {
		if (this._pendingTokens.length > 0) {
			return this._pendingTokens.shift() as Token;
		}
		return this._stream.advance();
	}

	private _pushTokenFront(token: Token): void {
		this._pendingTokens.unshift(token);
	}

	private _resetInlineState(position: number): void {
		this._pendingTokens = [];
		this._stream.reset(position);
	}

	private _isWhitespaceOnlyReduced(reduced: Inlines[]): boolean {
		if (reduced.length === 0) {
			return true;
		}

		return reduced.every(
			(node) => node.type === 'PLAIN_TEXT' && String((node as Plain).value).trim() === '',
		);
	}

	private _finishEmphasis(start: number, reduced: Inlines[], kind: 'bold' | 'italic' | 'strike'): Inlines | null {
		const nodes = reduced.length > 0 ? reduced : [plain('')];
		if (this._isWhitespaceOnlyReduced(nodes)) {
			this._resetInlineState(start);
			return null;
		}

		if (kind === 'bold') {
			return bold(nodes as any);
		}

		if (kind === 'italic') {
			return italic(nodes as any);
		}

		return strike(nodes as any);
	}

	private _lastContentChar(content: Inlines[]): string | undefined {
		for (let index = content.length - 1; index >= 0; index--) {
			const node = content[index];
			if (node.type === 'PLAIN_TEXT' && node.value.length > 0) {
				return node.value[node.value.length - 1];
			}
		}
		return undefined;
	}

	private _canEmitMention(token: Token, prev: Token): boolean {
		if (!prev || prev.kind === TokenKind.EOF) {
			return true;
		}
		if (prev.kind === TokenKind.WHITESPACE || prev.kind === TokenKind.NEWLINE) {
			return true;
		}
		if (prev.kind === TokenKind.UNDERSCORE) {
			return true;
		}
		if (prev.end !== token.start) {
			return true;
		}
		const last = prev.raw?.slice(-1) ?? '';
		return !/[A-Za-z0-9_\p{L}\p{N}]/u.test(last);
	}

	private _tryPromoteMentionToEmail(inlines: Inlines[], mention: Token): boolean {
		const lastInline = inlines[inlines.length - 1];
		if (!lastInline || lastInline.type !== 'PLAIN_TEXT') {
			return false;
		}
		const match = lastInline.value.match(/^(.*?)([\p{L}\p{N}._-]+)$/u);
		if (!match) {
			return false;
		}
		const [, prefix, local] = match;
		const next = this._peekToken(1);
		let candidate: string | null = null;
		let advanceCount = 0;
		if (next.kind === TokenKind.TEXT && next.value.startsWith('.')) {
			candidate = `${local}${mention.raw}${next.value}`;
			advanceCount = 2;
		} else if (mention.raw.includes('.')) {
			candidate = `${local}${mention.raw}`;
			advanceCount = 1;
		}
		if (!candidate) {
			return false;
		}
		const emailValue = candidate.startsWith('mailto:') ? candidate.slice(7) : candidate;
		const node = autoEmail(emailValue);
		if (node.type === 'PLAIN_TEXT') {
			lastInline.value = `${prefix}${candidate}`;
		} else {
			lastInline.value = prefix;
			if (lastInline.value.length === 0) {
				inlines.pop();
			}
			inlines.push(node as Inlines);
		}
		for (let i = 0; i < advanceCount; i++) {
			this._advanceToken();
		}
		return true;
	}

	private _splitPhoneToken(token: Token): { raw: string; number: string; trailing: string } {
		const match = /\s/.exec(token.raw);
		if (!match) {
			return { raw: token.raw, number: this._normalizePhoneNumber(token.value), trailing: '' };
		}
		const index = match.index;
		const raw = token.raw.slice(0, index);
		const trailing = token.raw.slice(index);
		const number = this._normalizePhoneNumber(raw);
		return { raw, number, trailing };
	}

	private _consumeAnglePlain(stopKinds: ReadonlySet<TokenKind>): string | null {
		if (!this._stream.at(TokenKind.ANGLE_OPEN)) {
			return null;
		}

		let value = this._stream.advance().raw;

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();
			if (stopKinds.has(token.kind) || token.kind === TokenKind.TILDE) {
				if (token.kind === TokenKind.NEWLINE) {
					this._suppressNextBlockquote = true;
				}
				break;
			}
			value += token.raw;
			this._stream.advance();
		}

		return value;
	}

	private _consumeBracketedPlain(stopKinds: ReadonlySet<TokenKind>): string | null {
		if (!this._stream.at(TokenKind.LINK_OPEN)) {
			return null;
		}

		let value = this._stream.advance().raw;
		let foundClose = false;

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();
			if (stopKinds.has(token.kind) || token.kind === TokenKind.NEWLINE) {
				break;
			}
			value += token.raw;
			this._stream.advance();
			if (token.raw.includes(']')) {
				foundClose = true;
				break;
			}
		}

		return foundClose ? value : value;
	}

	private _isEmptyBlockquoteLine(): boolean {
		let offset = 1;
		const next = this._stream.peek(offset);
		if (next.kind === TokenKind.WHITESPACE) {
			offset++;
		}
		const after = this._stream.peek(offset);
		return after.kind === TokenKind.NEWLINE || after.kind === TokenKind.EOF;
	}

	private _canUnderscoreOpenEmphasis(): boolean {
		if (this._strikeDepth > 0) return true;

		const opener = this._peekToken();
		if (opener.kind !== TokenKind.UNDERSCORE || opener.value !== '_') return true;

		const prev = this._stream.peek(-1);
		const prevRaw = prev.raw ?? '';
		const prevLast = prevRaw.length > 0 ? prevRaw[prevRaw.length - 1] : undefined;
		if (prevLast !== undefined && /[A-Za-z0-9]/.test(prevLast)) return false;

		let tildeCount = 0;
		let offset = 1;

		while (true) {
			const tok = this._peekToken(offset);
			if (!tok || tok.kind === TokenKind.EOF || tok.kind === TokenKind.NEWLINE) return true;

			if (tok.kind === TokenKind.UNDERSCORE && tok.value === '_') break;

			if (tok.kind === TokenKind.TILDE) tildeCount++;

			offset++;
		}

		if (tildeCount % 2 === 0) return true;

		offset++;
		while (true) {
			const tok = this._peekToken(offset);
			if (!tok || tok.kind === TokenKind.EOF || tok.kind === TokenKind.NEWLINE) return true;

			if (tok.kind === TokenKind.TILDE) return false;
			if (tok.kind === TokenKind.UNDERSCORE && tok.value === '_') return true;

			offset++;
		}
	}

	/** `_hello_text` / `_ouch_ouch`: opening `_` would pair across an interior snake_case boundary — skip italic. */
	private _isSnakeUnderscoreEmphasisTrap(): boolean {
		const word = this._peekToken(1);
		const mid = this._peekToken(2);
		const after = this._peekToken(3);

		if (
			word.kind !== TokenKind.TEXT ||
			mid.kind !== TokenKind.UNDERSCORE ||
			mid.value !== '_' ||
			after.kind !== TokenKind.TEXT
		) {
			return false;
		}

		return /^[A-Za-z0-9]+$/.test(word.value) && /^[A-Za-z0-9]/.test(after.value.charAt(0));
	}

	/** Mirrors pegjs `Italic` consuming `[a-zA-Z0-9]+ (__)` before a `__` span — not an italic opener. */
	private _doubleUnderscoreItalicPrevEndsWithWordChar(): boolean {
		const prev = this._stream.peek(-1);
		const ch = this._getBoundaryChar(prev, true);
		return ch !== undefined && /[A-Za-z0-9]/.test(ch);
	}

	/**
	 * Pegjs `Italic` emits plain when `__ … __` is immediately followed by `[a-zA-Z0-9]`
	 * — opener must not run when the next `__` closes before such a suffix.
	 */
	private _doubleUnderscoreItalicWouldCloseBeforeTrailingWord(): boolean {
		let sawWs = false;
		for (let offset = 1; offset < 128; offset++) {
			const t = this._peekToken(offset);
			if (t.kind === TokenKind.EOF || t.kind === TokenKind.NEWLINE) {
				return false;
			}
			if (t.kind === TokenKind.WHITESPACE) {
				sawWs = true;
			}
			if (t.kind === TokenKind.UNDERSCORE && t.value === '__') {
				if (sawWs) {
					return false;
				}
				const next = this._peekToken(offset + 1);
				return next.kind === TokenKind.TEXT && /^[a-zA-Z0-9]/.test(next.value);
			}
		}
		return false;
	}

	/** Pegjs `Italic` branch that flattens `__ … __` + trailing `$[a-zA-Z0-9]+` into plain runs. */
	private _consumePegBrokenDoubleUnderscorePlain(stopKinds: ReadonlySet<TokenKind>, out: Inlines[]): void {
		this._advanceToken();
		out.push(plain('__'));

		while (!this._stream.isEOF() || this._pendingTokens.length > 0) {
			const t = this._peekToken();

			if (stopKinds.has(t.kind)) {
				return;
			}

			if (t.kind === TokenKind.EOF) {
				return;
			}

			if (t.kind === TokenKind.UNDERSCORE && t.value === '__') {
				this._advanceToken();
				out.push(plain('__'));

				const tail = this._peekToken();
				if (tail.kind === TokenKind.TEXT) {
					const exec = /^([a-zA-Z0-9]+)([\s\S]*)$/.exec(tail.value);
					if (exec !== null && exec[1].length > 0) {
						this._advanceToken();
						out.push(plain(exec[1]));
						if (exec[2].length > 0) {
							this._pushTokenFront({
								...tail,
								raw: exec[2],
								value: exec[2],
								start: tail.start + exec[1].length,
								end: tail.end,
							});
						}
					}
				}

				return;
			}

			this._advanceToken();
			out.push(plain(t.raw));
		}
	}

	private _getBoundaryChar(token: Token, fromEnd: boolean): string | undefined {
		const value = token.value ?? '';
		if (value.length === 0) {
			return undefined;
		}
		return fromEnd ? value[value.length - 1] : value[0];
	}

	private _isWordChar(ch: string | undefined): boolean {
		if (!ch) {
			return false;
		}
		return /[A-Za-z0-9]/.test(ch);
	}

	private _countParens(value: string): number {
		let depth = 0;
		for (const ch of value) {
			if (ch === '(') {
				depth++;
			} else if (ch === ')') {
				depth--;
			}
		}
		return depth;
	}

	private _joinHrefTokens(tokens: Token[]): string | null {
		if (tokens.length === 0) {
			return '';
		}

		if (tokens.length === 1 && tokens[0].kind === TokenKind.PHONE) {
			return `tel:${this._normalizePhoneNumber(tokens[0].value)}`;
		}

		let href = '';
		for (const token of tokens) {
			href += token.value;
		}

		return href;
	}

	private _labelContainsBracketSeparator(label: Inlines[]): boolean {
		let value = '';
		for (const entry of label) {
			if (entry.type !== 'PLAIN_TEXT') {
				return false;
			}
			value += entry.value;
		}
		return value.includes('] [');
	}

	private _tokensToPlain(tokens: Token[]): Plain {
		let value = '';
		for (const token of tokens) {
			value += token.value;
		}
		return plain(value);
	}

	private _parseTimestampToken(value: string, raw: string): Inlines | null {
		const formatChars = new Set(['t', 'T', 'd', 'D', 'f', 'F', 'R']);
		let format: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 't';
		let datePart = value;

		const lastColon = value.lastIndexOf(':');
		if (lastColon !== -1 && lastColon === value.length - 2) {
			const formatCandidate = value[value.length - 1];
			if (!formatChars.has(formatCandidate)) {
				return null;
			}
			format = formatCandidate as typeof format;
			datePart = value.slice(0, -2);
		}

		if (/^\d{10}$/.test(datePart)) {
			return timestamp(datePart, format);
		}

		const isoMillis = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})([+-]\d{2}:\d{2})?$/;
		const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/;
		const timeWithSeconds = /^(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/;
		const timeNoSeconds = /^(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/;

		let match = isoMillis.exec(datePart);
		if (match) {
			const valueFromIso = timestampFromIsoTime({
				year: match[1],
				month: match[2],
				day: match[3],
				hours: match[4],
				minutes: match[5],
				seconds: match[6],
				milliseconds: match[7],
				timezone: match[8],
			} as unknown as Parameters<typeof timestampFromIsoTime>[0]);
			return timestamp(valueFromIso, format);
		}

		match = iso.exec(datePart);
		if (match) {
			const valueFromIso = timestampFromIsoTime({
				year: match[1],
				month: match[2],
				day: match[3],
				hours: match[4],
				minutes: match[5],
				seconds: match[6],
				timezone: match[7],
			} as unknown as Parameters<typeof timestampFromIsoTime>[0]);
			return timestamp(valueFromIso, format);
		}

		match = timeWithSeconds.exec(datePart);
		if (match) {
			const valueFromHours = timestampFromHours(match[1], match[2], match[3], match[4]);
			return timestamp(valueFromHours, format);
		}

		match = timeNoSeconds.exec(datePart);
		if (match) {
			const valueFromHours = timestampFromHours(match[1], match[2], undefined, match[3]);
			return timestamp(valueFromHours, format);
		}

		return null;
	}

	private _parseColorToken(hex: string): Inlines | null {
		let expanded = hex;
		if (hex.length === 3 || hex.length === 4) {
			expanded = '';
			for (const ch of hex) {
				expanded += ch + ch;
			}
		}

		if (expanded.length !== 6 && expanded.length !== 8) {
			return null;
		}

		const r = Number.parseInt(expanded.slice(0, 2), 16);
		const g = Number.parseInt(expanded.slice(2, 4), 16);
		const b = Number.parseInt(expanded.slice(4, 6), 16);
		const a = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255;

		if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a)) {
			return null;
		}

		return color(r, g, b, a);
	}

	private _normalizePhoneNumber(value: string): string {
		return value.replace(/[^0-9]/g, '');
	}

	private _consumeNewlines(): number {
		let count = 0;

		while (this._stream.at(TokenKind.NEWLINE)) {
			this._stream.advance();
			count++;
		}

		return count;
	}

	private _parsePlainTexts(stopKinds: ReadonlySet<TokenKind>): Plain[] {
		const chunks: Plain[] = [];

		while (!this._stream.isEOF()) {
			const token = this._stream.peek();

			if (stopKinds.has(token.kind)) {
				break;
			}

			this._stream.advance();

			switch (token.kind) {
				case TokenKind.TEXT:
				case TokenKind.WHITESPACE:
				case TokenKind.ESCAPED:
					chunks.push(plain(token.value));
					break;
				default:
					chunks.push(plain(token.raw));
			}
		}

		return reducePlainTexts(chunks) as Plain[];
	}

	protected _enterRecursion(): boolean {
		this._depth++;
		return this._depth > MAX_DEPTH;
	}

	protected _leaveRecursion(): void {
		this._depth--;
	}
}
