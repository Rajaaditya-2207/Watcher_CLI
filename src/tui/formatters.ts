import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');
const DIM_GREEN = chalk.hex('#1a8a0a');
const BLUE = chalk.hex('#7aa2f7');

/**
 * Format markdown content for clean terminal/TUI display.
 */
export function formatMarkdown(content: string): string {
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
                formatted.push('');
                formatted.push(DIM_GREEN('┌─') + chalk.dim(label) + DIM_GREEN('─'.repeat(Math.max(1, 55 - label.length)) + '┐'));
            } else {
                inCodeBlock = false;
                formatted.push(DIM_GREEN('└' + '─'.repeat(58) + '┘'));
                formatted.push('');
            }
            continue;
        }

        if (inCodeBlock) {
            formatted.push(DIM_GREEN('│ ') + NEON(line));
            continue;
        }

        if (trimmed === '') { formatted.push(''); continue; }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            formatted.push(DIM_GREEN('─'.repeat(58)));
            continue;
        }

        // Headings
        if (trimmed.startsWith('#### ')) { formatted.push(''); formatted.push(NEON('  ' + trimmed.substring(5))); continue; }
        if (trimmed.startsWith('### ')) { formatted.push(''); formatted.push(NEON.bold('▸ ' + trimmed.substring(4))); continue; }
        if (trimmed.startsWith('## ')) {
            const text = trimmed.substring(3);
            formatted.push('');
            formatted.push(NEON.bold(text));
            formatted.push(DIM_GREEN('─'.repeat(text.length + 2)));
            continue;
        }
        if (trimmed.startsWith('# ')) { formatted.push(''); formatted.push(NEON.bold.underline(trimmed.substring(2))); formatted.push(''); continue; }

        // Block quotes
        if (trimmed.startsWith('> ')) { formatted.push(DIM_GREEN('│ ') + BLUE.italic(trimmed.substring(2))); continue; }

        // Apply inline formatting
        let formattedLine = applyInline(trimmed);

        // Unordered lists
        const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
        if (ulMatch) {
            const indent = Math.floor(ulMatch[1].length / 2);
            formatted.push('  '.repeat(indent) + NEON('•') + ' ' + applyInline(ulMatch[3]));
            continue;
        }

        // Ordered lists
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (olMatch) {
            const indent = Math.floor(olMatch[1].length / 2);
            formatted.push('  '.repeat(indent) + NEON(olMatch[2] + '.') + ' ' + applyInline(olMatch[3]));
            continue;
        }

        formatted.push(formattedLine);
    }

    let result = formatted.join('\n');
    result = result.replace(/\n{3,}/g, '\n\n');
    return result.trim();
}

function applyInline(text: string): string {
    let r = text;
    r = r.replace(/`([^`]+)`/g, (_, c) => chalk.bgHex('#1a1a2e').hex('#39FF14')(` ${c} `));
    r = r.replace(/\*\*\*([^*]+)\*\*\*/g, (_, t) => chalk.white.bold.italic(t));
    r = r.replace(/\*\*([^*]+)\*\*/g, (_, t) => chalk.white.bold(t));
    r = r.replace(/__([^_]+)__/g, (_, t) => chalk.white.bold(t));
    r = r.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, t) => chalk.italic(t));
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => BLUE.underline(label));
    r = r.replace(/~~([^~]+)~~/g, (_, t) => chalk.dim.strikethrough(t));
    return r;
}
