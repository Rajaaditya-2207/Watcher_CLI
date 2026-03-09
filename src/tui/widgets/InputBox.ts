import blessed from 'blessed';
import { EventEmitter } from 'events';
import { COLORS } from '../theme';

/**
 * Styled input box at the bottom of the screen.
 * Emits 'submit' with the input text on Enter.
 */
export class InputBox extends EventEmitter {
    public box: blessed.Widgets.BoxElement;
    public textarea: blessed.Widgets.TextareaElement;

    constructor(parent: blessed.Widgets.Screen | blessed.Widgets.Node, placeholder: string = 'Ask anything...') {
        super();

        // Container with left blue border
        this.box = blessed.box({
            parent,
            bottom: 0,
            left: 2,
            right: 2,
            height: 3,
            border: {
                type: 'line',
            },
            style: {
                border: {
                    fg: COLORS.blue,
                },
                bg: COLORS.bgInput,
            },
        });

        // Text input
        this.textarea = blessed.textarea({
            parent: this.box,
            top: 0,
            left: 1,
            right: 1,
            height: 1,
            inputOnFocus: true,
            style: {
                fg: COLORS.white,
                bg: COLORS.bgInput,
            },
        });

        // Handle Enter to submit
        this.textarea.key('enter', () => {
            const value = this.textarea.getValue().trim();
            if (value) {
                this.emit('submit', value);
                this.textarea.clearValue();
                // Must render the screen (not the parent box) to actually repaint
                this.textarea.screen.render();
            }
            return false; // prevent default behavior of adding newline
        });

        // Handle Escape
        this.textarea.key('escape', () => {
            this.textarea.cancel();
        });
    }

    focus(): void {
        this.textarea.focus();
    }

    setValue(text: string): void {
        this.textarea.setValue(text);
    }

    getValue(): string {
        return this.textarea.getValue();
    }

    destroy(): void {
        this.textarea.destroy();
        this.box.destroy();
    }
}
