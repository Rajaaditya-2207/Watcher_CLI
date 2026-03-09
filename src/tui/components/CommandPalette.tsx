import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');
const DIM = chalk.hex('#8b949e');
const CYAN = chalk.hex('#7dcfff');

export interface SlashCommand {
    name: string;
    description: string;
}

interface CommandPaletteProps {
    visible: boolean;
    filter: string;
    commands: SlashCommand[];
    selectedIndex: number;
    /** Called when the user clicks a palette item with the mouse. */
    onSelect?: (fullCommandName: string) => void;
}

/**
 * Parent command names whose sub-commands are shown when the parent is typed exactly.
 * e.g. typing "/config" shows only "config" (view) and "config edit".
 */
export const PARENT_COMMANDS = ['config', 'session', 'daemon', 'insights'];

/**
 * Returns the filtered command list for the given input string.
 * Exported so App.tsx can use the same logic for keyboard handling and mouse clicks.
 */
export function getPaletteFiltered(commands: SlashCommand[], input: string): SlashCommand[] {
    const query = (input.startsWith('/') ? input.slice(1) : input).toLowerCase().trim();
    if (!query) return commands;

    // Exact parent name typed — show only that parent's sub-commands
    if (PARENT_COMMANDS.includes(query)) {
        return commands.filter(c => c.name.toLowerCase().startsWith(query + ' '));
    }

    // Parent + partial sub-command typed — filter within that parent's sub-commands
    const parent = PARENT_COMMANDS.find(p => query.startsWith(p + ' '));
    if (parent) {
        const sub = query.slice(parent.length + 1);
        return commands.filter(c =>
            c.name.toLowerCase().startsWith(parent + ' ') &&
            c.name.toLowerCase().slice(parent.length + 1).includes(sub),
        );
    }

    // Normal fuzzy filter across all commands
    return commands.filter(
        c => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query),
    );
}

/**
 * Slash-command palette popup.
 * Appears above the input when the user types "/", filtered as they type.
 * In sub-command mode (exact parent typed) shows a breadcrumb and short labels.
 */
export function CommandPalette({ visible, filter, commands, selectedIndex, onSelect }: CommandPaletteProps) {
    if (!visible) return null;

    const query = (filter.startsWith('/') ? filter.slice(1) : filter).toLowerCase().trim();
    const isSubMode = PARENT_COMMANDS.includes(query);
    const filtered = getPaletteFiltered(commands, filter);

    if (filtered.length === 0) return null;

    // Extra row for breadcrumb header in sub-command mode
    const extraRows = isSubMode ? 1 : 0;
    const paletteHeight = Math.min(filtered.length + 2 + extraRows, 14);

    return (
        <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="#1a8a0a"
            paddingLeft={1}
            paddingRight={1}
            height={paletteHeight}
        >
            {/* Breadcrumb shown when in sub-command mode */}
            {isSubMode && (
                <Text>{CYAN('/' + query)}{DIM('  -- select sub-command (arrows + enter / click)')}</Text>
            )}
            {filtered.map((cmd, i) => {
                const isSelected = i === selectedIndex;
                const bg = chalk.bgHex('#39FF14').black;

                // In sub-mode show short label (the part after the parent name)
                // e.g. "config edit" → "edit", "session new" → "new"
                const label = isSubMode
                    ? cmd.name.slice(query.length + 1)
                    : '/' + cmd.name;

                const nameStr = isSelected ? bg(label) : NEON(label);
                const descStr = isSelected ? bg(cmd.description) : DIM(cmd.description);

                return (
                    <Text key={cmd.name}>
                        {nameStr}{'  '}{descStr}
                    </Text>
                );
            })}
        </Box>
    );
}
