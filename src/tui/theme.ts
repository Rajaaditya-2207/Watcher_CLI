/**
 * Watcher TUI Theme — color palette, border styles, and text styles.
 *
 * NOTE: blessed maps hex colors to the nearest xterm-256 palette entry.
 * Very dark values (< #303030) tend to collapse to indistinguishable entries.
 * Keep contrasting colors ≥3 palette entries apart.
 */

export const COLORS = {
    // Primary accent
    neon: '#39FF14',
    dimGreen: '#1a8a0a',

    // Backgrounds
    bg: '#0d1117',
    bgLight: '#161b22',
    bgInput: '#1a1a2e',
    msgBg: '#303030',       // palette 236 — message bubble bg
    userBg: '#1a3050',      // user message bg

    // Text
    white: '#c9d1d9',
    dimWhite: '#8b949e',

    // Accent colors
    blue: '#7aa2f7',        // user accent / input border
    cyan: '#7dcfff',        // tool messages
    yellow: '#e0af68',      // warnings
    purple: '#bb9af7',      // special
    red: '#f7768e',         // errors

    // Borders & structure
    border: '#30363d',
    bubbleBorder: '#444444', // palette 238

    // Semantic (OpenCode-inspired)
    primary: '#39FF14',     // = neon — accent for assistant messages
    secondary: '#7aa2f7',   // = blue — accent for user messages
    textMuted: '#8b949e',   // = dimWhite
    success: '#39FF14',
    error: '#f7768e',
    warning: '#e0af68',
    info: '#7dcfff',
};

export const STYLES = {
    border: {
        fg: COLORS.dimGreen,
        bg: COLORS.bg,
    },
    focus: {
        border: {
            fg: COLORS.blue,
        },
    },
    input: {
        fg: COLORS.white,
        bg: COLORS.bgInput,
        border: {
            fg: COLORS.blue,
        },
    },
    label: {
        fg: COLORS.neon,
        bold: true,
    },
    statusBar: {
        fg: COLORS.dimWhite,
        bg: COLORS.bgLight,
    },
};
