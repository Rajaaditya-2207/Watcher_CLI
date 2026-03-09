import blessed from 'blessed';
import { COLORS } from './theme';

/**
 * Central TUI screen manager.
 * Creates and manages the blessed screen, global keys, and cleanup.
 */
export class TuiScreen {
    public screen: blessed.Widgets.Screen;

    constructor(title: string = 'Watcher') {
        this.screen = blessed.screen({
            smartCSR: true,
            title,
            fullUnicode: true,
            cursor: {
                artificial: false, // Let textarea handle its own native input cursor
                shape: 'line',
                blink: true,
                color: COLORS.neon,
            },
        });

        // Global exit keys
        this.screen.key(['C-c'], () => {
            this.destroy();
            process.exit(0);
        });
    }

    render(): void {
        this.screen.render();
    }

    destroy(): void {
        this.screen.destroy();
    }

    onResize(callback: () => void): void {
        this.screen.on('resize', callback);
    }

    get width(): number {
        return (this.screen.width as number) || 80;
    }

    get height(): number {
        return (this.screen.height as number) || 24;
    }
}
