import blessed from 'blessed';
import { COLORS } from '../theme';

export interface SlashCommand {
    name: string;
    description: string;
}

/**
 * A popup list that shows available slash commands when the user types "/".
 * Filters as the user types more characters. Enter selects and fills the input.
 */
export class CommandPalette {
    public box: blessed.Widgets.ListElement;
    private screen: blessed.Widgets.Screen;
    private commands: SlashCommand[];
    private visible = false;
    private filteredCommands: SlashCommand[] = [];
    private onSelect: (command: string) => void;

    constructor(
        parent: blessed.Widgets.Node,
        screen: blessed.Widgets.Screen,
        commands: SlashCommand[],
        onSelect: (command: string) => void,
    ) {
        this.screen = screen;
        this.commands = commands;
        this.onSelect = onSelect;

        this.box = blessed.list({
            parent,
            bottom: 3,
            left: 2,
            width: 50,
            height: Math.min(commands.length + 2, 12),
            border: { type: 'line' },
            tags: true,
            scrollable: true,
            mouse: true,
            keys: false,
            vi: false,
            hidden: true,
            style: {
                fg: COLORS.white,
                bg: COLORS.bgLight,
                border: { fg: COLORS.dimGreen },
                selected: {
                    fg: COLORS.bg,
                    bg: COLORS.neon,
                    bold: true,
                },
            },
        } as any);
    }

    /**
     * Show the palette filtered by the current input text (e.g. "/con").
     */
    show(filter: string): void {
        const query = filter.startsWith('/') ? filter.substring(1).toLowerCase() : filter.toLowerCase();

        this.filteredCommands = this.commands.filter(
            (cmd) => cmd.name.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query),
        );

        if (this.filteredCommands.length === 0) {
            this.hide();
            return;
        }

        const items = this.filteredCommands.map(
            (cmd) => `{${COLORS.neon}-fg}/${cmd.name}{/}  {${COLORS.dimWhite}-fg}${cmd.description}{/}`,
        );

        this.box.setItems(items as any);
        this.box.height = Math.min(this.filteredCommands.length + 2, 12);
        this.box.select(0);
        this.box.show();
        this.visible = true;
        this.screen.render();
    }

    hide(): void {
        if (this.visible) {
            this.box.hide();
            this.visible = false;
            this.screen.render();
        }
    }

    isVisible(): boolean {
        return this.visible;
    }

    selectNext(): void {
        if (!this.visible) return;
        const idx = (this.box as any).selected ?? 0;
        if (idx < this.filteredCommands.length - 1) {
            this.box.select(idx + 1);
            this.screen.render();
        }
    }

    selectPrev(): void {
        if (!this.visible) return;
        const idx = (this.box as any).selected ?? 0;
        if (idx > 0) {
            this.box.select(idx - 1);
            this.screen.render();
        }
    }

    /**
     * Confirm the currently highlighted command. Returns the full command string.
     */
    confirm(): string | null {
        if (!this.visible || this.filteredCommands.length === 0) return null;
        const idx = (this.box as any).selected ?? 0;
        const cmd = this.filteredCommands[idx];
        this.hide();
        return `/${cmd.name}`;
    }

    destroy(): void {
        this.box.destroy();
    }
}
