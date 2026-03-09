import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');
const DIM_GREEN = chalk.hex('#1a8a0a');
const WHITE = chalk.hex('#c9d1d9');
const DIM = chalk.hex('#8b949e');

interface SidePanelProps {
    projectName: string;
    branchName: string;
    sessionName: string;
    sessionId: string;
    changes: number;
    analyses: number;
    tokens: number;
    provider: string;
    model: string;
    autoDocsEnabled: boolean;
    activityLog: string[];
}

/**
 * Right-side status/activity panel.
 * Shows project info, session stats, AI provider, and activity log.
 */
export function SidePanel(props: SidePanelProps) {
    const estimatedCost = (props.tokens * 0.000002).toFixed(4);

    return (
        <Box
            flexDirection="column"
            width="30%"
            borderStyle="single"
            borderColor="#1a8a0a"
            paddingLeft={1}
            paddingRight={1}
        >
            {/* Dashboard header */}
            <Text color="#39FF14" bold>{'Status'}</Text>
            <Text>{NEON.bold('Project')}</Text>
            <Text>{WHITE(props.projectName)}</Text>
            <Text>{DIM(props.branchName)}</Text>
            <Text>{''}</Text>

            <Text>{NEON.bold('Session')}</Text>
            <Text>{WHITE(new Date().toLocaleDateString() + ', ' + new Date().toLocaleTimeString())}</Text>
            <Text>{WHITE(props.sessionName)}</Text>
            <Text>{DIM('ID: ' + props.sessionId)}</Text>
            <Text>{WHITE('Changes:  ' + props.changes)}</Text>
            <Text>{WHITE('Analyses: ' + props.analyses)}</Text>
            <Text>{WHITE('Tokens:   ' + props.tokens)}</Text>
            <Text>{DIM('Est Cost: ~$' + estimatedCost)}</Text>
            <Text>{''}</Text>

            <Text>{NEON.bold('AI Provider')}</Text>
            <Text>{WHITE(props.provider)}</Text>
            <Text>{DIM(props.model)}</Text>
            <Text>{''}</Text>

            <Text>{NEON.bold('Features')}</Text>
            <Text>{WHITE('Auto Docs: ' + (props.autoDocsEnabled ? 'On' : 'Off'))}</Text>
            <Text>{''}</Text>

            <Text>{DIM_GREEN('─'.repeat(25))}</Text>
            <Text>{DIM('Recent Activity:')}</Text>

            {/* Activity log */}
            {props.activityLog.slice(-8).map((entry, i) => (
                <Text key={i} wrap="truncate">{entry}</Text>
            ))}
        </Box>
    );
}
