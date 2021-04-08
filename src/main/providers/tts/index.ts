import type { Schema } from '@main/schema';
import type { TTSProviderOptions, TTSProviderMethods, TTSProviderConfig } from '@main/providers/TTSProvider';
import WebSpeechSynthesisApi from './WebSpeechSynthesisApi';

export function defineTTSProvider<ID extends string, S extends Schema, D>(arg: TTSProviderOptions<ID, S, D>, methods: TTSProviderMethods<ID, S, D>) {
    return { ...arg, ...methods, providersStoreKey: 'ttsProviders' } as TTSProviderConfig<ID, S, D>;
}

export const availableTTSConfigs = [WebSpeechSynthesisApi] as const;
export type AvailableTTSConfigs = typeof availableTTSConfigs;
