import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');
const WHITE = chalk.hex('#c9d1d9');
const DIM = chalk.hex('#8b949e');

interface StatusBarProps {
    mode: string;
    model: string;
    provider: string;
}

/**
 * Bottom status bar showing mode, model, provider, and keyboard shortcuts.
 * Inspired by OpenCode's contextual help text.
 */
export function StatusBar({ mode, model, provider }: StatusBarProps) {
    const shortcuts = [
        { key: '/', label: 'cmds' },
        { key: 'ctrl+n', label: 'new' },
        { key: 'ctrl+a', label: 'sessions' },
        { key: 'ctrl+l', label: 'clear' },
        { key: 'ctrl+c', label: 'quit' },
    ];

    const shortcutText = shortcuts.map(s =>
        `${DIM(s.key)} ${WHITE(s.label)}`
    ).join('  ');

    return (
        <Box height={2} flexDirection="column" paddingLeft={1}>
            <Text>
                {NEON.bold(mode)}{'  '}{WHITE(model)}{'  '}{DIM(provider)}
            </Text>
            <Text>{shortcutText}</Text>
        </Box>
    );
}
