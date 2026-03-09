import blessed from 'blessed';
import { COLORS } from '../theme';

/**
 * Bottom status bar showing mode, model, and keyboard shortcuts.
 */
export class StatusBar {
    public box: blessed.Widgets.BoxElement;

    constructor(parent: blessed.Widgets.Screen) {
        this.box = blessed.box({
            parent,
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            tags: true,
            style: {
                fg: COLORS.dimWhite,
                bg: COLORS.bgLight,
            },
        });

        this.setDefault();
    }

    update(mode: string, model: string, provider: string): void {
        const modeLabel = `{${COLORS.neon}-fg}{bold}${mode}{/}`;
        const modelLabel = `{${COLORS.white}-fg}${model}{/}`;
        const providerLabel = `{${COLORS.dimWhite}-fg}${provider}{/}`;

        const left = `  ${modeLabel}  ${modelLabel}  ${providerLabel}`;
        const shortcuts = this.shortcutRow();

        this.box.setContent(`${left}\n${shortcuts}`);
    }

    setDefault(): void {
        const shortcuts = this.shortcutRow();
        this.box.setContent(
            `  {${COLORS.neon}-fg}{bold}Chat{/}  {${COLORS.dimWhite}-fg}Watcher v0.1.0{/}\n${shortcuts}`
        );
    }

    private shortcutRow(): string {
        const items = [
            { key: '/', label: 'cmds' },
            { key: 'ctrl+n', label: 'new' },
            { key: 'ctrl+a', label: 'sessions' },
            { key: 'ctrl+l', label: 'clear' },
            { key: 'ctrl+c', label: 'quit' },
        ];
        return '  ' + items.map(i =>
            `{${COLORS.dimWhite}-fg}${i.key}{/} {${COLORS.white}-fg}${i.label}{/}`
        ).join('  ');
    }

    destroy(): void {
        this.box.destroy();
    }
}
