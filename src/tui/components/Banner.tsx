import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

const BANNER_ART = [
    '██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███████╗██████╗ ',
    '██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔══██╗',
    '██║ █╗ ██║███████║   ██║   ██║     ███████║█████╗  ██████╔╝',
    '██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██╔══╝  ██╔══██╗',
    '╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║███████╗██║  ██║',
    ' ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
];

interface BannerProps {
    projectName?: string;
    provider?: string;
    model?: string;
    cwd?: string;
}

export function Banner({ projectName, provider, model, cwd }: BannerProps) {
    const neon = chalk.hex('#39FF14');
    const dim = chalk.hex('#1a8a0a');
    const white = chalk.hex('#c9d1d9');
    const muted = chalk.hex('#8b949e');

    const bannerText = BANNER_ART.map(line => neon(line)).join('\n');

    const infoLines: string[] = [
        '',
        dim('Silent Observer. Intelligent Documentation.'),
        dim('v0.1.0 | Team KREONYX'),
    ];

    if (projectName || cwd) {
        infoLines.push('');
        if (projectName) infoLines.push(`${white('Project:')} ${neon(projectName)}`);
        if (cwd) infoLines.push(muted(cwd));
    }

    if (provider || model) {
        infoLines.push('');
        const parts: string[] = [];
        if (provider) parts.push(`${muted('Provider:')} ${white(provider)}`);
        if (model) parts.push(`${muted('Model:')} ${white(model)}`);
        infoLines.push(parts.join('  '));
    }

    infoLines.push('');
    infoLines.push(muted('Type a message or press / for commands'));

    return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <Text>{bannerText}</Text>
            {infoLines.map((line, i) => (
                <Text key={i}>{line}</Text>
            ))}
        </Box>
    );
}
