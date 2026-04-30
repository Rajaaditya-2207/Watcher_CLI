import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { WatcherConfig } from '../../types/index.js';
import { COLORS } from '../theme.js';

type FieldType = 'enum' | 'string' | 'number' | 'boolean' | 'secret';

interface ConfigField {
    key: string;
    label: string;
    type: FieldType;
    options?: string[];
    get: (c: WatcherConfig) => any;
    set: (c: WatcherConfig, v: any) => WatcherConfig;
}

const CONFIG_FIELDS: ConfigField[] = [
    {
        key: 'aiProvider', label: 'AI Provider', type: 'enum',
        options: ['anthropic', 'gemini', 'openai', 'ollama', 'lmstudio', 'llamacpp', 'openrouter', 'groq', 'bedrock'],
        get: c => c.aiProvider,
        set: (c, v) => ({ ...c, aiProvider: v }),
    },
    {
        key: 'model', label: 'Model', type: 'string',
        get: c => c.model,
        set: (c, v) => ({ ...c, model: v }),
    },
    {
        key: 'apiKey', label: 'API Key', type: 'secret',
        get: _ => '',
        set: (c, _) => c,
    },
    {
        key: 'watchInterval', label: 'Watch Interval (ms)', type: 'number',
        get: c => c.watchInterval,
        set: (c, v) => ({ ...c, watchInterval: v }),
    },
    {
        key: 'autoDocumentation', label: 'Auto Documentation', type: 'boolean',
        get: c => c.features.autoDocumentation,
        set: (c, v) => ({ ...c, features: { ...c.features, autoDocumentation: v } }),
    },
    {
        key: 'technicalDebt', label: 'Tech Debt Tracking', type: 'boolean',
        get: c => c.features.technicalDebt,
        set: (c, v) => ({ ...c, features: { ...c.features, technicalDebt: v } }),
    },
    {
        key: 'analytics', label: 'Analytics', type: 'boolean',
        get: c => c.features.analytics,
        set: (c, v) => ({ ...c, features: { ...c.features, analytics: v } }),
    },
    {
        key: 'defaultFormat', label: 'Report Format', type: 'enum',
        options: ['markdown', 'json', 'slack'],
        get: c => c.reporting.defaultFormat,
        set: (c, v) => ({ ...c, reporting: { ...c.reporting, defaultFormat: v } }),
    },
    {
        key: 'includeMetrics', label: 'Include Metrics', type: 'boolean',
        get: c => c.reporting.includeMetrics,
        set: (c, v) => ({ ...c, reporting: { ...c.reporting, includeMetrics: v } }),
    },
];

const TOTAL_ITEMS = CONFIG_FIELDS.length + 2;

export interface ModelInfo {
    id: string;
    name: string;
}

export interface ConfigEditorProps {
    config: WatcherConfig;
    apiKeyIsSet: boolean;
    onSave: (config: WatcherConfig, newApiKey?: string) => void;
    onCancel: () => void;
    fetchModels?: (stagedKey?: string) => Promise<ModelInfo[]>;
}

export function ConfigEditor({ config, apiKeyIsSet, onSave, onCancel, fetchModels }: ConfigEditorProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [editConfig, setEditConfig] = useState<WatcherConfig>({
        ...config,
        features: { ...config.features },
        reporting: { ...config.reporting },
    });

    const [editingField, setEditingField] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState('');

    const [apiKeyBuffer, setApiKeyBuffer] = useState('');
    const [keyStatus, setKeyStatus] = useState(apiKeyIsSet);

    const [modelSearchMode, setModelSearchMode] = useState(false);
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [modelFilter, setModelFilter] = useState('');
    const [modelSearchIndex, setModelSearchIndex] = useState(0);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsError, setModelsError] = useState<string | null>(null);

    const filteredModels = modelFilter
        ? modelList.filter(m =>
            m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
            m.name.toLowerCase().includes(modelFilter.toLowerCase())
        )
        : modelList;

    const safeModelIdx = Math.min(modelSearchIndex, Math.max(0, filteredModels.length - 1));

    const enterModelSearch = useCallback(async () => {
        if (!fetchModels) {
            setEditingField('model');
            setEditBuffer(editConfig.model);
            return;
        }
        setModelSearchMode(true);
        setModelFilter('');
        setModelSearchIndex(0);
        setModelsLoading(true);
        setModelsError(null);
        try {
            const models = await fetchModels(apiKeyBuffer || undefined);
            setModelList(models);
            const idx = models.findIndex(m => m.id === editConfig.model);
            if (idx >= 0) setModelSearchIndex(idx);
        } catch (err: any) {
            setModelsError(err.message);
        } finally {
            setModelsLoading(false);
        }
    }, [fetchModels, editConfig.model]);

    useInput((char, key) => {

        // Model search mode
        if (modelSearchMode) {
            if (key.escape) { setModelSearchMode(false); setModelFilter(''); return; }
            if (key.return) {
                if (filteredModels.length > 0 && !modelsLoading) {
                    setEditConfig(prev => ({ ...prev, model: filteredModels[safeModelIdx].id }));
                }
                setModelSearchMode(false);
                setModelFilter('');
                return;
            }
            if (key.upArrow) { setModelSearchIndex(prev => Math.max(0, prev - 1)); return; }
            if (key.downArrow) { setModelSearchIndex(prev => Math.min((filteredModels.length || 1) - 1, prev + 1)); return; }
            if (key.backspace || key.delete) { setModelFilter(prev => prev.slice(0, -1)); setModelSearchIndex(0); return; }
            if (char && !key.ctrl && !key.meta) { setModelFilter(prev => prev + char); setModelSearchIndex(0); }
            return;
        }

        // Inline edit mode
        if (editingField) {
            if (key.return) {
                const field = CONFIG_FIELDS.find(f => f.key === editingField)!;
                if (field.key === 'apiKey') {
                    if (editBuffer.trim()) { setApiKeyBuffer(editBuffer.trim()); setKeyStatus(true); }
                    setEditingField(null); setEditBuffer('');
                    return;
                }
                let value: any = editBuffer;
                if (field.type === 'number') {
                    const parsed = parseInt(editBuffer, 10);
                    if (isNaN(parsed) || parsed <= 0) { setEditingField(null); setEditBuffer(''); return; }
                    value = parsed;
                }
                setEditConfig(prev => field.set(prev, value));
                setEditingField(null); setEditBuffer('');
                return;
            }
            if (key.escape) { setEditingField(null); setEditBuffer(''); return; }
            if (key.backspace || key.delete) { setEditBuffer(prev => prev.slice(0, -1)); return; }
            if (char && !key.ctrl && !key.meta) { setEditBuffer(prev => prev + char); }
            return;
        }

        // Normal navigation
        if (key.upArrow) { setSelectedIndex(prev => Math.max(0, prev - 1)); return; }
        if (key.downArrow) { setSelectedIndex(prev => Math.min(TOTAL_ITEMS - 1, prev + 1)); return; }
        if (key.escape) { onCancel(); return; }
        if (key.ctrl && char === 's') { onSave(editConfig, apiKeyBuffer || undefined); return; }

        if (key.return || char === ' ') {
            if (selectedIndex === CONFIG_FIELDS.length) { onSave(editConfig, apiKeyBuffer || undefined); return; }
            if (selectedIndex === CONFIG_FIELDS.length + 1) { onCancel(); return; }

            const field = CONFIG_FIELDS[selectedIndex];
            if (field.type === 'boolean') {
                setEditConfig(prev => field.set(prev, !field.get(prev)));
            } else if (field.type === 'enum' && field.options) {
                const curr = field.get(editConfig);
                const next = field.options[(field.options.indexOf(curr) + 1) % field.options.length];
                setEditConfig(prev => field.set(prev, next));
            } else if (field.key === 'model') {
                enterModelSearch();
            } else {
                setEditingField(field.key);
                setEditBuffer(field.key === 'apiKey' ? '' : String(field.get(editConfig)));
            }
        }
    });

    const labelWidth = 24;

    // Model search view
    if (modelSearchMode) {
        const VISIBLE = 14;
        const start = Math.max(0, safeModelIdx - Math.floor(VISIBLE / 2));
        const visible = filteredModels.slice(start, start + VISIBLE);

        return (
            <Box flexDirection="column" paddingX={1}>
                <Box marginBottom={1}>
                    <Text color={COLORS.neon} bold>{'--- Model Search ---'}</Text>
                </Box>

                <Box marginBottom={1}>
                    <Text color={COLORS.dimWhite}>{'Filter: '}</Text>
                    <Text color={COLORS.cyan}>{modelFilter || ' '}</Text>
                    <Text color={COLORS.dimWhite}>{'_'}</Text>
                </Box>

                {modelsLoading && <Text color={COLORS.yellow}>{'  Loading models...'}</Text>}
                {modelsError && <Text color={COLORS.red}>{`  Error: ${modelsError}`}</Text>}
                {!modelsLoading && !modelsError && filteredModels.length === 0 && (
                    <Text color={COLORS.dimWhite}>{'  No models match your filter.'}</Text>
                )}

                {visible.map((m, i) => {
                    const absIdx = start + i;
                    const isSel = absIdx === safeModelIdx;
                    return (
                        <Box key={m.id}>
                            <Text color={isSel ? COLORS.neon : COLORS.dimWhite}>{isSel ? ' > ' : '   '}</Text>
                            <Text color={isSel ? COLORS.white : COLORS.dimWhite}>{m.id}</Text>
                            {m.name !== m.id && (
                                <Text color={COLORS.dimWhite}>{`  (${m.name})`}</Text>
                            )}
                        </Box>
                    );
                })}

                {filteredModels.length > VISIBLE && (
                    <Text color={COLORS.dimWhite}>{`  ... ${filteredModels.length} models total`}</Text>
                )}

                <Box marginTop={1}>
                    <Text color={COLORS.dimWhite}>{'Type to filter  Up/Dn Navigate  Enter Select  Esc Back'}</Text>
                </Box>
            </Box>
        );
    }

    // Main editor view
    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text color={COLORS.neon} bold>{'--- Config Editor ---'}</Text>
            </Box>

            {CONFIG_FIELDS.map((field, i) => {
                const isSel = i === selectedIndex;
                const isEditing = editingField === field.key;
                let displayValue: React.ReactNode;
                let hint = '';

                if (field.key === 'apiKey') {
                    if (isEditing) {
                        displayValue = (
                            <Text>
                                <Text color={COLORS.cyan}>{editBuffer.replace(/./g, '*')}</Text>
                                <Text color={COLORS.dimWhite}>{'_'}</Text>
                            </Text>
                        );
                    } else if (apiKeyBuffer) {
                        displayValue = <Text color={COLORS.yellow}>{'(new key staged - save to apply)'}</Text>;
                    } else {
                        const isLocal = ['ollama', 'lmstudio', 'llamacpp'].includes(editConfig.aiProvider);
                        if (isLocal) {
                            displayValue = <Text color={COLORS.dimWhite}>{'(not required)'}</Text>;
                        } else {
                            displayValue = keyStatus
                                ? <Text color={COLORS.neon}>{'(set)'}</Text>
                                : <Text color={COLORS.red}>{'(not set)'}</Text>;
                        }
                    }
                    if (isSel && !isEditing) hint = ' (Enter to edit)';
                } else if (isEditing) {
                    displayValue = (
                        <Text>
                            <Text color={COLORS.cyan}>{editBuffer}</Text>
                            <Text color={COLORS.dimWhite}>{'_'}</Text>
                        </Text>
                    );
                } else if (field.type === 'boolean') {
                    const val = field.get(editConfig);
                    displayValue = val
                        ? <Text color={COLORS.neon} bold>{'ON '}</Text>
                        : <Text color={COLORS.dimWhite}>{'OFF'}</Text>;
                    if (isSel) hint = ' (Enter to toggle)';
                } else if (field.type === 'enum' && field.options) {
                    const curr = field.get(editConfig);
                    displayValue = (
                        <Text>
                            {field.options.map((opt, oi) => (
                                <Text key={opt}>
                                    {oi > 0 && <Text color={COLORS.dimWhite}>{' | '}</Text>}
                                    {opt === curr
                                        ? <Text color={COLORS.neon} bold>{opt}</Text>
                                        : <Text color={COLORS.dimWhite}>{opt}</Text>}
                                </Text>
                            ))}
                        </Text>
                    );
                    if (isSel) hint = ' (Enter to cycle)';
                } else {
                    displayValue = <Text color={COLORS.white}>{String(field.get(editConfig))}</Text>;
                    if (isSel && !isEditing) {
                        hint = field.key === 'model'
                            ? (fetchModels ? ' (Enter to search)' : ' (Enter to edit)')
                            : ' (Enter to edit)';
                    }
                }

                return (
                    <Box key={field.key}>
                        <Text color={isSel ? COLORS.neon : COLORS.dimWhite}>{isSel ? ' > ' : '   '}</Text>
                        <Text color={isSel ? COLORS.white : COLORS.dimWhite}>{field.label.padEnd(labelWidth)}</Text>
                        {displayValue}
                        {hint && <Text color={COLORS.dimWhite}>{hint}</Text>}
                    </Box>
                );
            })}

            <Box marginTop={1}>
                <Text color={selectedIndex === CONFIG_FIELDS.length ? COLORS.neon : COLORS.dimWhite}>
                    {selectedIndex === CONFIG_FIELDS.length ? ' > ' : '   '}
                </Text>
                <Text
                    color={selectedIndex === CONFIG_FIELDS.length ? COLORS.neon : COLORS.dimWhite}
                    bold={selectedIndex === CONFIG_FIELDS.length}
                >
                    {'[ Save ]'}
                </Text>
                <Text>{'    '}</Text>
                <Text color={selectedIndex === CONFIG_FIELDS.length + 1 ? COLORS.red : COLORS.dimWhite}>
                    {selectedIndex === CONFIG_FIELDS.length + 1 ? ' > ' : '   '}
                </Text>
                <Text
                    color={selectedIndex === CONFIG_FIELDS.length + 1 ? COLORS.red : COLORS.dimWhite}
                    bold={selectedIndex === CONFIG_FIELDS.length + 1}
                >
                    {'[ Cancel ]'}
                </Text>
            </Box>

            <Box marginTop={1}>
                <Text color={COLORS.dimWhite}>
                    {'Up/Dn Navigate  Enter/Space Toggle/Edit  Ctrl+S Save  Esc Cancel'}
                </Text>
            </Box>
        </Box>
    );
}