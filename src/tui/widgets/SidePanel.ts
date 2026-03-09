import blessed from 'blessed';
import { COLORS } from '../theme';

/**
 * Right-side panel for watch mode showing status, context, and file changes.
 */
export class SidePanel {
    public box: blessed.Widgets.BoxElement;
    private contentLines: string[] = [];
    private screen: blessed.Widgets.Screen;

    constructor(parent: blessed.Widgets.Screen, opts: {
        title?: string;
        width?: number | string;
        right?: number;
    } = {}) {
        this.screen = parent;

        this.box = blessed.box({
            parent,
            top: 0,
            right: opts.right ?? 0,
            width: opts.width ?? '30%',
            bottom: 2,
            border: {
                type: 'line',
            },
            label: opts.title ? ` ${opts.title} ` : undefined,
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            mouse: true,
            style: {
                fg: COLORS.white,
                bg: COLORS.bg,
                border: {
                    fg: COLORS.dimGreen,
                },
                label: {
                    fg: COLORS.neon,
                    bold: true,
                },
            },
        });
    }

    /**
     * Set the full content of the panel.
     */
    setContent(content: string): void {
        this.box.setContent(content);
        this.screen.render();
    }

    /**
     * Update a named section in the panel.
     */
    setSection(title: string, content: string): void {
        const sectionHeader = `{${COLORS.neon}-fg}{bold}${title}{/}`;
        const sectionContent = content;

        // Find and replace existing section, or add new
        const marker = `__SECTION_${title}__`;
        const existingIdx = this.contentLines.findIndex((l) => l.startsWith(marker));

        const newLines = [marker, sectionHeader, sectionContent, ''];

        if (existingIdx >= 0) {
            // Find end of section
            let endIdx = existingIdx + 1;
            while (endIdx < this.contentLines.length && !this.contentLines[endIdx].startsWith('__SECTION_')) {
                endIdx++;
            }
            this.contentLines.splice(existingIdx, endIdx - existingIdx, ...newLines);
        } else {
            this.contentLines.push(...newLines);
        }

        // Render without markers
        const displayContent = this.contentLines
            .filter((l) => !l.startsWith('__SECTION_'))
            .join('\n');

        this.box.setContent(displayContent);
        this.screen.render();
    }

    /**
     * Add a line to the log area at the bottom.
     */
    addLogLine(line: string): void {
        const current = this.box.getContent();
        this.box.setContent(current + '\n' + line);
        this.box.setScrollPerc(100);
        this.screen.render();
    }

    destroy(): void {
        this.box.destroy();
    }
}
