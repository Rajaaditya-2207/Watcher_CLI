import blessed from 'blessed';
import { COLORS } from '../theme';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    metadata?: string;
}

/**
 * Scrollable message list for the chat conversation.
 *
 * Rendering approach (inspired by OpenCode):
 * - Messages use a thick left-border accent (┃) colored by role
 *   instead of full-background blocks (which are unreliable in 256-color).
 * - User messages have blue left border, assistant messages have green.
 * - A "thinking" indicator with animated spinner shows during AI processing.
 */
export class MessageList {
    public box: blessed.Widgets.BoxElement;
    private messages: ChatMessage[] = [];
    private screen: blessed.Widgets.Screen;
    private thinkingActive = false;
    private spinnerFrame = 0;
    private spinnerInterval: NodeJS.Timeout | null = null;
    private static SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

    constructor(parent: blessed.Widgets.Screen | blessed.Widgets.Node, opts: {
        top?: number | string;
        bottom?: number | string;
        left?: number | string;
        right?: number | string;
        width?: number | string;
    } = {}) {
        this.screen = ('render' in parent ? parent : parent.screen) as blessed.Widgets.Screen;

        this.box = blessed.box({
            parent,
            top: opts.top ?? 0,
            left: opts.left ?? 0,
            right: opts.right ?? 0,
            bottom: opts.bottom ?? 6,
            width: opts.width,
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                style: { bg: COLORS.dimGreen },
            },
            mouse: true,
            keys: false,
            vi: false,
            tags: true,
            style: {
                fg: COLORS.white,
                bg: COLORS.bg,
            },
        });

        // Mouse scroll
        this.box.on('wheeldown', () => {
            this.box.scroll(3);
            this.screen.render();
        });
        this.box.on('wheelup', () => {
            this.box.scroll(-3);
            this.screen.render();
        });
    }

    // ─── Public API ────────────────────────────────────────────

    addMessage(msg: ChatMessage): void {
        this.messages.push(msg);
        this.renderMessages();
    }

    addToolMessage(toolName: string, description: string): void {
        this.messages.push({
            role: 'tool',
            content: `{${COLORS.cyan}-fg}⚙{/} {${COLORS.dimWhite}-fg}[${toolName}]{/} {${COLORS.dimWhite}-fg}${description}{/}`,
        });
        this.renderMessages();
    }

    clear(): void {
        this.messages = [];
        this.box.setContent('');
        this.screen.render();
    }

    /** Show animated thinking indicator */
    showThinking(): void {
        if (this.thinkingActive) return;
        this.thinkingActive = true;
        this.spinnerFrame = 0;

        this.spinnerInterval = setInterval(() => {
            this.spinnerFrame = (this.spinnerFrame + 1) % MessageList.SPINNER_FRAMES.length;
            this.renderMessages();
        }, 80);
    }

    /** Hide thinking indicator */
    hideThinking(): void {
        this.thinkingActive = false;
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
            this.spinnerInterval = null;
        }
        this.renderMessages();
    }

    // ─── Rendering ─────────────────────────────────────────────

    private renderMessages(): void {
        const lines: string[] = [];
        const width = this.getContentWidth();

        for (const msg of this.messages) {
            if (msg.role === 'user') {
                this.renderUserMessage(lines, msg, width);
            } else if (msg.role === 'tool') {
                lines.push(`  ${msg.content}`);
            } else if (msg.role === 'assistant') {
                this.renderAssistantMessage(lines, msg, width);
            }
        }

        // Thinking indicator (OpenCode-inspired spinner)
        if (this.thinkingActive) {
            const spinner = MessageList.SPINNER_FRAMES[this.spinnerFrame];
            lines.push('');
            lines.push(`  {${COLORS.neon}-fg}{bold}${spinner} Thinking...{/}`);
        }

        this.box.setContent(lines.join('\n'));
        this.box.setScrollPerc(100);
        this.screen.render();
    }

    // ─── Message renderers (OpenCode-style left-border accent) ─

    /**
     * User message: blue thick left border (┃), role label "You"
     */
    private renderUserMessage(lines: string[], msg: ChatMessage, width: number): void {
        const accent = COLORS.secondary; // blue
        const contentWidth = width - 6;

        lines.push('');
        lines.push(`  {${accent}-fg}┃{/} {${accent}-fg}{bold}You{/}`);

        const escaped = this.escapeContent(msg.content);
        const wrapped = this.wrapPlainText(escaped, contentWidth);
        for (const wl of wrapped) {
            lines.push(`  {${accent}-fg}┃{/}  ${wl}`);
        }

        lines.push(`  {${accent}-fg}┃{/}`);
        lines.push('');
    }

    /**
     * Assistant message: green thick left border (┃), role label "Watcher",
     * with full markdown formatting.
     */
    private renderAssistantMessage(lines: string[], msg: ChatMessage, width: number): void {
        const accent = COLORS.primary; // green/neon
        const contentWidth = width - 6;

        lines.push('');
        lines.push(`  {${accent}-fg}┃{/} {${accent}-fg}{bold}Watcher{/}`);
        lines.push(`  {${accent}-fg}┃{/}`);

        const formatted = this.formatAssistantContent(msg.content, contentWidth);
        const collapsed = this.collapseBlankLines(formatted.split('\n'));
        for (const fl of collapsed) {
            lines.push(`  {${accent}-fg}┃{/} ${fl}`);
        }

        if (msg.metadata) {
            lines.push(`  {${accent}-fg}┃{/}`);
            lines.push(`  {${accent}-fg}┃{/}  {${COLORS.dimWhite}-fg}${msg.metadata}{/}`);
        }

        lines.push(`  {${accent}-fg}┃{/}`);
        lines.push('');
    }

    // ─── Text utilities ────────────────────────────────────────

    private getContentWidth(): number {
        const w = this.box.width;
        return (typeof w === 'number' ? w : 80) - 1;
    }

    /** Calculate visible length of a string that may contain blessed tags. */
    private visualLength(tagged: string): number {
        return tagged.replace(/\{[^}]*\}/g, '').length;
    }

    /**
     * Word-wrap tagged text (containing blessed {tags}) to fit within maxWidth
     * visible columns. Tag characters are ignored for width calculation.
     */
    private wrapTaggedText(text: string, maxWidth: number): string[] {
        if (maxWidth <= 0) maxWidth = 40;
        const tokenRegex = /(\{[^}]*\})/g;
        const tokens = text.split(tokenRegex).filter(t => t.length > 0);

        const result: string[] = [];
        let line = '';
        let lineVisLen = 0;

        for (const token of tokens) {
            if (token.startsWith('{') && token.endsWith('}')) {
                line += token;
                continue;
            }

            const words = token.split(/( +)/);
            for (const word of words) {
                if (word.length === 0) continue;

                if (lineVisLen + word.length > maxWidth && lineVisLen > 0 && word.trim().length > 0) {
                    result.push(line);
                    line = '';
                    lineVisLen = 0;
                    if (word.trim().length === 0) continue;
                }

                line += word;
                lineVisLen += word.length;
            }
        }
        if (line) result.push(line);

        return result.length > 0 ? result : [''];
    }

    /** Word-wrap plain (untagged) text to fit within maxWidth columns. */
    private wrapPlainText(text: string, maxWidth: number): string[] {
        if (maxWidth <= 0) maxWidth = 40;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return [''];

        const result: string[] = [];
        let line = '';

        for (const word of words) {
            if (line.length + word.length + 1 > maxWidth && line.length > 0) {
                result.push(line);
                line = word;
            } else {
                line += (line.length > 0 ? ' ' : '') + word;
            }
        }
        if (line) result.push(line);

        return result;
    }

    /** Collapse runs of consecutive blank lines down to a single blank line. */
    private collapseBlankLines(lines: string[]): string[] {
        const result: string[] = [];
        let prevBlank = false;
        for (const line of lines) {
            const isBlank = line.trim() === '';
            if (isBlank && prevBlank) continue;
            result.push(line);
            prevBlank = isBlank;
        }
        return result;
    }

    // ─── Inline markdown ───────────────────────────────────────

    /**
     * Apply inline markdown (bold, inline code) to raw text.
     * Called BEFORE wrapping so **bold across words** doesn't break.
     */
    private applyInlineFormatting(raw: string): string {
        let result = '';
        let i = 0;
        while (i < raw.length) {
            if (raw[i] === '`') {
                const end = raw.indexOf('`', i + 1);
                if (end > i) {
                    const code = raw.substring(i + 1, end);
                    result += `{${COLORS.cyan}-fg}${blessed.escape(code)}{/}`;
                    i = end + 1;
                    continue;
                }
            }

            if (raw[i] === '*' && raw[i + 1] === '*') {
                const end = raw.indexOf('**', i + 2);
                if (end > i) {
                    const bold = raw.substring(i + 2, end);
                    result += `{bold}${blessed.escape(bold)}{/bold}`;
                    i = end + 2;
                    continue;
                }
            }

            if (raw[i] === '_' && raw[i + 1] === '_') {
                const end = raw.indexOf('__', i + 2);
                if (end > i) {
                    const bold = raw.substring(i + 2, end);
                    result += `{bold}${blessed.escape(bold)}{/bold}`;
                    i = end + 2;
                    continue;
                }
            }

            let plainRun = '';
            while (i < raw.length) {
                if (raw[i] === '`') break;
                if (raw[i] === '*' && raw[i + 1] === '*') break;
                if (raw[i] === '_' && raw[i + 1] === '_') break;
                plainRun += raw[i];
                i++;
            }
            result += blessed.escape(plainRun);
        }

        return result;
    }

    // ─── Markdown formatting ───────────────────────────────────

    /**
     * Format assistant markdown content using blessed tags.
     * Each line will have the left-border accent prepended by the caller.
     */
    private formatAssistantContent(content: string, maxWidth: number): string {
        const lines = content.split('\n');
        const formatted: string[] = [];
        let inCodeBlock = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Code blocks
            if (trimmed.startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    const lang = trimmed.substring(3).trim();
                    const label = lang ? ` ${lang} ` : '';
                    const barLen = Math.max(1, Math.min(50, maxWidth - 6) - label.length);
                    formatted.push(`   {${COLORS.dimGreen}-fg}┌─${label}${'─'.repeat(barLen)}┐{/}`);
                } else {
                    inCodeBlock = false;
                    formatted.push(`   {${COLORS.dimGreen}-fg}└${'─'.repeat(Math.min(53, maxWidth - 4))}┘{/}`);
                }
                continue;
            }

            if (inCodeBlock) {
                formatted.push(`   {${COLORS.dimGreen}-fg}│{/} {${COLORS.neon}-fg}${blessed.escape(line)}{/}`);
                continue;
            }

            if (trimmed === '') { formatted.push(''); continue; }

            // Horizontal rule
            if (/^[-*_]{3,}$/.test(trimmed)) {
                formatted.push(`   {${COLORS.dimGreen}-fg}${'─'.repeat(Math.min(50, maxWidth - 4))}{/}`);
                continue;
            }

            // Headings
            if (trimmed.startsWith('#### ')) {
                formatted.push(`   {${COLORS.neon}-fg}{bold}▸ ${blessed.escape(trimmed.substring(5))}{/}`);
                continue;
            }
            if (trimmed.startsWith('### ')) {
                formatted.push('');
                formatted.push(`   {${COLORS.neon}-fg}{bold}▸ ${blessed.escape(trimmed.substring(4))}{/}`);
                continue;
            }
            if (trimmed.startsWith('## ')) {
                const text = trimmed.substring(3);
                formatted.push('');
                formatted.push(`   {${COLORS.neon}-fg}{bold}${blessed.escape(text)}{/}`);
                formatted.push(`   {${COLORS.dimGreen}-fg}${'─'.repeat(Math.min(text.length + 2, maxWidth - 4))}{/}`);
                continue;
            }
            if (trimmed.startsWith('# ')) {
                formatted.push('');
                formatted.push(`   {${COLORS.neon}-fg}{bold}{underline}${blessed.escape(trimmed.substring(2))}{/}`);
                continue;
            }

            // Block quote
            if (trimmed.startsWith('> ')) {
                const quoteTagged = this.applyInlineFormatting(trimmed.substring(2));
                const wrapped = this.wrapTaggedText(quoteTagged, maxWidth - 8);
                for (const ql of wrapped) {
                    formatted.push(`   {${COLORS.dimGreen}-fg}│{/} {${COLORS.blue}-fg}${ql}{/}`);
                }
                continue;
            }

            // Unordered list
            const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
            if (ulMatch) {
                const indent = Math.floor(ulMatch[1].length / 2);
                const prefix = '  '.repeat(indent);
                const tagged = this.applyInlineFormatting(ulMatch[3]);
                const bulletWidth = maxWidth - prefix.length - 6;
                const wrapped = this.wrapTaggedText(tagged, bulletWidth);
                formatted.push(`   ${prefix}{${COLORS.neon}-fg}•{/} ${wrapped[0]}`);
                for (let j = 1; j < wrapped.length; j++) {
                    formatted.push(`   ${prefix}  ${wrapped[j]}`);
                }
                continue;
            }

            // Ordered list
            const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
            if (olMatch) {
                const indent = Math.floor(olMatch[1].length / 2);
                const prefix = '  '.repeat(indent);
                const tagged = this.applyInlineFormatting(olMatch[3]);
                const numWidth = maxWidth - prefix.length - 6;
                const wrapped = this.wrapTaggedText(tagged, numWidth);
                formatted.push(`   ${prefix}{${COLORS.neon}-fg}${olMatch[2]}.{/} ${wrapped[0]}`);
                for (let j = 1; j < wrapped.length; j++) {
                    formatted.push(`   ${prefix}   ${wrapped[j]}`);
                }
                continue;
            }

            // Regular paragraph
            const tagged = this.applyInlineFormatting(trimmed);
            const wrapped = this.wrapTaggedText(tagged, maxWidth - 3);
            for (const wl of wrapped) {
                formatted.push(`   ${wl}`);
            }
        }

        return formatted.join('\n');
    }

    private escapeContent(text: string): string {
        return blessed.escape(text);
    }

    destroy(): void {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
        }
        this.box.destroy();
    }
}
