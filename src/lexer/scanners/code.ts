import { ScanContext, flushText, emit } from '../ScanContext';
import { TokenKind } from '../Token';
import { CH_BACKTICK, CH_LF, CH_CR } from '../constants/charCodes';

/** Slice from start of current line up to `pos` (excluding `pos`). */
function linePrefixBefore(input: string, pos: number): string {
    let lineStart = 0;
    for (let i = pos - 1; i >= 0; i--) {
        const c = input.charCodeAt(i);
        if (c === CH_LF || c === CH_CR) {
            lineStart = i + 1;
            break;
        }
    }

    return input.slice(lineStart, pos);
}

/** Indented-only prefix before ``` — tests keep these as plain (`  \\`\\`\\``), not fences. */
function isIndentedWhitespaceOnlyPrefix(prefix: string): boolean {
    return prefix.length > 0 && /^[ \t]+$/.test(prefix);
}

/** Scanner for `` ` ``: dispatches to fenced-block or inline-code scanning. */
export function scanBacktick(ctx: ScanContext, pos: number): number {
    flushText(ctx, pos);
    const { input } = ctx;
    if (
        input.charCodeAt(pos + 1) === CH_BACKTICK &&
        input.charCodeAt(pos + 2) === CH_BACKTICK
    ) {
        const prefix = linePrefixBefore(input, pos);
        if (isIndentedWhitespaceOnlyPrefix(prefix)) {
            emit(ctx, TokenKind.TEXT, '```', '```', pos);
            return pos + 3;
        }

        return scanFencedBlock(ctx, pos);
    }
    return scanInlineCode(ctx, pos);
}

/** Scans a ` ``` ` fenced code block, emitting open/content/close tokens. */
function scanFencedBlock(ctx: ScanContext, pos: number): number {
    const { input, len } = ctx;
    emit(ctx, TokenKind.TRIPLE_BACKTICK, '```', '```', pos);
    pos += 3;

    const bodyStart = pos;
    while (pos < len) {
        if (
            input.charCodeAt(pos) === CH_BACKTICK &&
            input.charCodeAt(pos + 1) === CH_BACKTICK &&
            input.charCodeAt(pos + 2) === CH_BACKTICK
        ) {
            emitCodeBody(ctx, bodyStart, pos);
            emit(ctx, TokenKind.TRIPLE_BACKTICK, '```', '```', pos);
            return pos + 3;
        }
        pos++;
    }

    // unclosed fence
    emitCodeBody(ctx, bodyStart, pos);
    return pos;
}

/** Scans a single-backtick inline code span that cannot cross a line boundary. */
function scanInlineCode(ctx: ScanContext, pos: number): number {
    const { input, len } = ctx;
    emit(ctx, TokenKind.BACKTICK, '`', '`', pos);
    pos += 1;

    const bodyStart = pos;
    while (pos < len) {
        const c = input.charCodeAt(pos);
        if (c === CH_BACKTICK) {
            emitCodeBody(ctx, bodyStart, pos);
            emit(ctx, TokenKind.BACKTICK, '`', '`', pos);
            return pos + 1;
        }
        if (c === CH_LF || c === CH_CR) {
            // unclosed
            emitTextBody(ctx, bodyStart, pos);
            return pos;
        }
        pos++;
    }

    // EOF
    emitTextBody(ctx, bodyStart, pos);
    return pos;
}

/** Emits a {@link TokenKind.CODE_CONTENT} token for the slice `[start, end)` if non-empty. */
function emitCodeBody(ctx: ScanContext, start: number, end: number): void {
    if (end > start) {
        const body = ctx.input.slice(start, end);
        emit(ctx, TokenKind.CODE_CONTENT, body, body, start);
    }
}

/** Emits a {@link TokenKind.TEXT} token for the slice `[start, end)` if non-empty. */
function emitTextBody(ctx: ScanContext, start: number, end: number): void {
    if (end > start) {
        const body = ctx.input.slice(start, end);
        emit(ctx, TokenKind.TEXT, body, body, start);
    }
}
