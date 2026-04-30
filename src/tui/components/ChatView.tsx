import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');
const BLUE = chalk.hex('#7aa2f7');
const CYAN = chalk.hex('#7dcfff');
const DIM = chalk.hex('#8b949e');
const DIM_GREEN = chalk.hex('#1a8a0a');
const WHITE = chalk.hex('#c9d1d9');

// Grey background for message boxes — visible contrast against black terminal
const USER_BG = chalk.bgHex('#1c2129');
const ASST_BG = chalk.bgHex('#1c2129');

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    metadata?: string;
    timestamp?: number; // Unix ms
}

interface ChatViewProps {
    messages: ChatMessage[];
    isThinking: boolean;
    height: number;
    width: number;
    scrollOffset: number;
    autoScroll?: boolean;
    onMaxScrollChange?: (maxScroll: number) => void;
}

/**
 * Scrollable chat view.
 * Renders messages with grey background boxes, timestamps, and gaps between them.
 */
export function ChatView({ messages, isThinking, height, width, scrollOffset, autoScroll = true, onMaxScrollChange }: ChatViewProps) {
    const boxWidth = Math.max(40, width - 4); // usable width inside the chat area
    const lines = renderAllMessages(messages, boxWidth);
    const totalLines = lines.length + (isThinking ? 2 : 0);

    // Calculate visible window
    const maxScroll = Math.max(0, totalLines - height);

    // Report maxScroll to parent so it can set correct scrollOffset for manual scrolling
    if (onMaxScrollChange) {
        onMaxScrollChange(maxScroll);
    }

    // When autoScroll is true, always show the bottom; otherwise use the provided offset
    const actualOffset = autoScroll
        ? maxScroll
        : Math.min(Math.max(0, scrollOffset), maxScroll);

    // Add thinking indicator at the end
    const allLines = [...lines];
    if (isThinking) {
        allLines.push('');
        allLines.push('__SPINNER__');
    }

    const visibleLines = allLines.slice(actualOffset, actualOffset + height);

    return (
        <Box flexDirection="column" flexGrow={1} height={height}>
            {visibleLines.map((line, i) =>
                line === '__SPINNER__' ? (
                    <Text key={`s-${i}`}>
                        {'  '}
                        <Text color="#39FF14" bold>
                            <Spinner type="dots" /> Thinking...
                        </Text>
                    </Text>
                ) : (
                    <Text key={i} wrap="wrap">{line}</Text>
                )
            )}
        </Box>
    );
}

// --- Timestamp formatting ---

function formatTimestamp(ts?: number): string {
    if (!ts) return '';
    const d = new Date(ts);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${h12}:${m}:${s} ${ampm}`;
}

// --- Message rendering ---

function renderAllMessages(messages: ChatMessage[], width: number): string[] {
    const lines: string[] = [];
    const contentWidth = Math.max(30, width - 6);

    for (const msg of messages) {
        if (msg.role === 'user') {
            renderUserMessage(lines, msg, width, contentWidth);
        } else if (msg.role === 'tool') {
            const toolLines = msg.content.split('\n');
            for (const tl of toolLines) {
                const wrappedTool = wrapText(tl, Math.max(20, width - 4));
                for (const wtl of wrappedTool) {
                    lines.push(`  ${wtl}`);
                }
            }
        } else if (msg.role === 'assistant') {
            renderAssistantMessage(lines, msg, width, contentWidth);
        }
    }

    return lines;
}

/**
 * Pads a line to fill the box width with a background color.
 */
function padBg(text: string, totalWidth: number, bgFn: (s: string) => string): string {
    const visLen = stripAnsi(text).length;
    const pad = Math.max(0, totalWidth - visLen);
    // Reset all ANSI attributes after the line so bold/color from chalk formatting
    // never bleeds into subsequent lines (terminals maintain ANSI state globally).
    return bgFn(text + ' '.repeat(pad)) + '\x1b[0m';
}

function renderUserMessage(lines: string[], msg: ChatMessage, boxWidth: number, contentWidth: number): void {
    const accent = BLUE;
    const ts = formatTimestamp(msg.timestamp);

    // Blank line gap before message
    lines.push('');

    // Header line: "You" + timestamp on the right
    const headerLabel = accent.bold('You');
    const headerTs = ts ? DIM(ts) : '';
    const headerLabelLen = stripAnsi('You').length;
    const headerTsLen = ts ? stripAnsi(ts).length : 0;
    const headerGap = Math.max(1, boxWidth - 4 - headerLabelLen - headerTsLen);
    const headerLine = `  ${headerLabel}${' '.repeat(headerGap)}${headerTs}`;
    lines.push(padBg(headerLine, boxWidth, USER_BG));

    // Content lines
    const wrapped = wrapText(msg.content, contentWidth);
    for (const wl of wrapped) {
        lines.push(padBg(`  ${accent('\u2503')} ${WHITE(wl)}`, boxWidth, USER_BG));
    }

    // Bottom padding line
    lines.push(padBg(`  ${accent('\u2503')}`, boxWidth, USER_BG));

    // Blank line gap after message
    lines.push('');
}

function renderAssistantMessage(lines: string[], msg: ChatMessage, boxWidth: number, contentWidth: number): void {
    const accent = NEON;
    const ts = formatTimestamp(msg.timestamp);

    // Blank line gap before message
    lines.push('');

    // Header line: "Watcher" + timestamp on the right
    const headerLabel = accent.bold('Watcher');
    const headerTs = ts ? DIM(ts) : '';
    const headerLabelLen = stripAnsi('Watcher').length;
    const headerTsLen = ts ? stripAnsi(ts).length : 0;
    const headerGap = Math.max(1, boxWidth - 4 - headerLabelLen - headerTsLen);
    const headerLine = `  ${headerLabel}${' '.repeat(headerGap)}${headerTs}`;
    lines.push(padBg(headerLine, boxWidth, ASST_BG));

    // Separator after header
    lines.push(padBg(`  ${accent('\u2503')}`, boxWidth, ASST_BG));

    // Format content with markdown
    const formatted = formatAssistantContent(msg.content, contentWidth - 4);
    for (const fl of formatted) {
        lines.push(padBg(`  ${accent('\u2503')} ${fl}`, boxWidth, ASST_BG));
    }

    // Metadata line (model info, timing)
    if (msg.metadata) {
        lines.push(padBg(`  ${accent('\u2503')}`, boxWidth, ASST_BG));
        lines.push(padBg(`  ${accent('\u2503')} ${DIM(msg.metadata)}`, boxWidth, ASST_BG));
    }

    // Bottom padding line
    lines.push(padBg(`  ${accent('\u2503')}`, boxWidth, ASST_BG));

    // Blank line gap after message
    lines.push('');
}

// --- Markdown formatting (chalk-based) ---

function formatAssistantContent(content: string, wrapWidth: number): string[] {
    const rawLines = content.split('\n');
    const formatted: string[] = [];
    let inCodeBlock = false;

    for (const line of rawLines) {
        const trimmed = line.trim();

        // Code blocks
        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                const lang = trimmed.substring(3).trim();
                const label = lang ? ` ${lang} ` : '';
                const barLen = Math.max(1, 50 - label.length);
                formatted.push(`   ${DIM_GREEN('\u250C\u2500' + label + '\u2500'.repeat(barLen) + '\u2510')}`);
            } else {
                inCodeBlock = false;
                formatted.push(`   ${DIM_GREEN('\u2514' + '\u2500'.repeat(53) + '\u2518')}`);
            }
            continue;
        }

        if (inCodeBlock) {
            const codeLines = forceWrapAnsi(line, Math.max(10, wrapWidth - 5));
            for (const cl of codeLines) {
                formatted.push(`   ${DIM_GREEN('\u2502')} ${NEON(cl)}`);
            }
            continue;
        }

        if (trimmed === '') { formatted.push(''); continue; }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            formatted.push(`   ${DIM_GREEN('\u2500'.repeat(50))}`);
            continue;
        }

        // Headings
        if (trimmed.startsWith('#### ')) {
            const hText = trimmed.substring(5);
            const hWrapped = wrapText(hText, Math.max(20, wrapWidth - 5));
            for (const hw of hWrapped) {
                formatted.push(`   ${NEON.bold('\u25B8 ' + hw)}`);
            }
            continue;
        }
        if (trimmed.startsWith('### ')) {
            formatted.push('');
            const hText = trimmed.substring(4);
            const hWrapped = wrapText(hText, Math.max(20, wrapWidth - 5));
            for (const hw of hWrapped) {
                formatted.push(`   ${NEON.bold('\u25B8 ' + hw)}`);
            }
            continue;
        }
        if (trimmed.startsWith('## ')) {
            const text = trimmed.substring(3);
            formatted.push('');
            const hWrapped = wrapText(text, Math.max(20, wrapWidth - 3));
            for (const hw of hWrapped) {
                formatted.push(`   ${NEON.bold(hw)}`);
            }
            formatted.push(`   ${DIM_GREEN('\u2500'.repeat(Math.min(stripAnsi(text).length + 2, 50)))}`);
            continue;
        }
        if (trimmed.startsWith('# ')) {
            formatted.push('');
            const hText = trimmed.substring(2);
            const hWrapped = wrapText(hText, Math.max(20, wrapWidth - 3));
            for (const hw of hWrapped) {
                formatted.push(`   ${NEON.bold.underline(hw)}`);
            }
            continue;
        }

        // Block quote
        if (trimmed.startsWith('> ')) {
            const quotePrefix = `   ${DIM_GREEN('\u2502')} `;
            const quotePrefixLen = 5; // '   | '
            const quoteWrapped = wrapText(BLUE.italic(trimmed.substring(2)), Math.max(20, wrapWidth - quotePrefixLen));
            for (let qi = 0; qi < quoteWrapped.length; qi++) {
                formatted.push(`${quotePrefix}${quoteWrapped[qi]}`);
            }
            continue;
        }

        // Unordered list
        const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
        if (ulMatch) {
            const indent = Math.floor(ulMatch[1].length / 2);
            const prefix = '  '.repeat(indent);
            const bulletPrefix = `   ${prefix}${NEON('\u2022')} `;
            const contPrefix = `   ${prefix}  `;
            const bulletPrefixLen = 3 + indent * 2 + 2;
            const itemWrapped = wrapText(applyInline(ulMatch[3]), Math.max(20, wrapWidth - bulletPrefixLen));
            for (let wi = 0; wi < itemWrapped.length; wi++) {
                formatted.push(wi === 0 ? `${bulletPrefix}${itemWrapped[wi]}` : `${contPrefix}${itemWrapped[wi]}`);
            }
            continue;
        }

        // Ordered list
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (olMatch) {
            const indent = Math.floor(olMatch[1].length / 2);
            const prefix = '  '.repeat(indent);
            const numLabel = olMatch[2] + '.';
            const olPrefix = `   ${prefix}${NEON(numLabel)} `;
            const contPrefix = `   ${prefix}${' '.repeat(numLabel.length + 1)}`;
            const olPrefixLen = 3 + indent * 2 + numLabel.length + 1;
            const itemWrapped = wrapText(applyInline(olMatch[3]), Math.max(20, wrapWidth - olPrefixLen));
            for (let wi = 0; wi < itemWrapped.length; wi++) {
                formatted.push(wi === 0 ? `${olPrefix}${itemWrapped[wi]}` : `${contPrefix}${itemWrapped[wi]}`);
            }
            continue;
        }

        // Regular paragraph
        const effectiveWidth = Math.max(30, wrapWidth);
        const wrapped = wrapText(applyInline(trimmed), effectiveWidth);
        for (const wl of wrapped) {
            formatted.push(`   ${wl}`);
        }
    }

    // Collapse consecutive blank lines
    return collapseBlankLines(formatted);
}

function applyInline(text: string): string {
    let r = text;
    r = r.replace(/`([^`]+)`/g, (_, c) => CYAN(c));
    r = r.replace(/\*\*\*([^*]+)\*\*\*/g, (_, t) => chalk.white.bold.italic(t));
    r = r.replace(/\*\*([^*]+)\*\*/g, (_, t) => chalk.white.bold(t));
    r = r.replace(/__([^_]+)__/g, (_, t) => chalk.white.bold(t));
    r = r.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, t) => chalk.italic(t));
    r = r.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, (_, t) => chalk.italic(t));
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label) => BLUE.underline(label));
    r = r.replace(/~~([^~]+)~~/g, (_, t) => chalk.dim.strikethrough(t));
    return r;
}

function wrapText(text: string, maxWidth: number): string[] {
    if (maxWidth <= 0) maxWidth = 40;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [''];

    const result: string[] = [];
    let line = '';
    let visLen = 0;

    for (const word of words) {
        const wordVis = stripAnsi(word).length;
        
        if (wordVis > maxWidth) {
            if (line) {
                result.push(line);
                line = '';
                visLen = 0;
            }
            const hardWrapped = forceWrapAnsi(word, maxWidth);
            for (let i = 0; i < hardWrapped.length - 1; i++) {
                result.push(hardWrapped[i]);
            }
            line = hardWrapped[hardWrapped.length - 1];
            visLen = stripAnsi(line).length;
            continue;
        }

        if (visLen + wordVis + 1 > maxWidth && visLen > 0) {
            result.push(line);
            line = word;
            visLen = wordVis;
        } else {
            line += (visLen > 0 ? ' ' : '') + word;
            visLen += wordVis + (visLen > 0 ? 1 : 0);
        }
    }
    if (line) result.push(line);
    return result;
}

function forceWrapAnsi(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let currentLen = 0;
    
    let i = 0;
    while (i < text.length) {
        if (text[i] === '\x1b') {
            let escapeSeq = '\x1b';
            i++;
            while (i < text.length && text[i] !== 'm') {
                escapeSeq += text[i];
                i++;
            }
            if (i < text.length) {
                escapeSeq += text[i];
                i++;
            }
            currentLine += escapeSeq;
            continue;
        }
        
        currentLine += text[i];
        currentLen++;
        i++;
        
        if (currentLen >= maxWidth) {
            lines.push(currentLine + '\x1b[0m');
            currentLine = '';
            currentLen = 0;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function collapseBlankLines(lines: string[]): string[] {
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

/** Create a tool message string (used by App to inject into messages array). */
export function formatToolMessage(toolName: string, description: string): string {
    return `${CYAN('\u2699')} ${DIM('[' + toolName + ']')} ${DIM(description)}`;
}
