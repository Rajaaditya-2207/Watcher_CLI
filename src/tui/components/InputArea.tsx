import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputAreaProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (value: string) => void;
    placeholder?: string;
    isActive: boolean;
}

/**
 * Text input area at the bottom of the chat.
 * Uses ink-text-input for line editing with Enter to submit.
 */
export function InputArea({ value, onChange, onSubmit, placeholder, isActive }: InputAreaProps) {
    return (
        <Box
            borderStyle="single"
            borderColor="#7aa2f7"
            height={3}
            paddingLeft={1}
            paddingRight={1}
        >
            <Text color="#7aa2f7" bold>{'❯ '}</Text>
            {isActive ? (
                <TextInput
                    value={value}
                    onChange={onChange}
                    onSubmit={(text) => {
                        if (text.trim()) {
                            onSubmit(text.trim());
                        }
                    }}
                    placeholder={placeholder || 'Ask anything, or type / for commands...'}
                />
            ) : (
                <Text dimColor>{placeholder || 'Ask anything, or type / for commands...'}</Text>
            )}
        </Box>
    );
}
