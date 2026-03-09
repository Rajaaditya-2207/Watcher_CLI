import blessed from 'blessed';
import { COLORS } from '../theme';

const BANNER_ART = [
    '██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███████╗██████╗ ',
    '██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔══██╗',
    '██║ █╗ ██║███████║   ██║   ██║     ███████║█████╗  ██████╔╝',
    '██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██╔══╝  ██╔══██╗',
    '╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║███████╗██║  ██║',
    ' ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
];

export interface BannerOptions {
    projectName?: string;
    provider?: string;
    model?: string;
    cwd?: string;
}

export function createBanner(
    parent: blessed.Widgets.Screen | blessed.Widgets.Node,
    opts: BannerOptions = {},
): blessed.Widgets.BoxElement {
    const bannerText = BANNER_ART.join('\n');

    const infoLines: string[] = [
        `{${COLORS.dimGreen}-fg}Silent Observer. Intelligent Documentation.{/}`,
        `{${COLORS.dimGreen}-fg}v0.1.0 | Team KREONYX{/}`,
    ];

    // OpenCode-inspired: show project context below the logo
    if (opts.cwd || opts.projectName) {
        infoLines.push('');
        if (opts.projectName) {
            infoLines.push(`{${COLORS.white}-fg}Project:{/} {${COLORS.neon}-fg}${opts.projectName}{/}`);
        }
        if (opts.cwd) {
            infoLines.push(`{${COLORS.dimWhite}-fg}${opts.cwd}{/}`);
        }
    }

    if (opts.provider || opts.model) {
        infoLines.push('');
        const parts: string[] = [];
        if (opts.provider) parts.push(`{${COLORS.dimWhite}-fg}Provider:{/} {${COLORS.white}-fg}${opts.provider}{/}`);
        if (opts.model) parts.push(`{${COLORS.dimWhite}-fg}Model:{/} {${COLORS.white}-fg}${opts.model}{/}`);
        infoLines.push(parts.join('  '));
    }

    infoLines.push('');
    infoLines.push(`{${COLORS.textMuted}-fg}Type a message or press / for commands{/}`);

    const content = `{center}${bannerText}\n\n${infoLines.join('\n')}{/center}`;

    const banner = blessed.box({
        parent,
        top: 'center',
        left: 'center',
        width: 65,
        height: BANNER_ART.length + infoLines.length + 4,
        content,
        tags: true,
        style: {
            fg: COLORS.neon,
            bg: COLORS.bg,
        },
    });

    return banner;
}
