import type { Schema } from '@main/schema';
import type { TtsProviderOptions, TtsProviderMethods, TtsProviderConfig } from '@main/providers/TtsProvider';
import WebSpeechSynthesisApi from './WebSpeechSynthesisApi';

export function defineTtsProvider<ID extends string, S extends Schema, D>(arg: TtsProviderOptions<ID, S, D>, methods: TtsProviderMethods<ID, S, D>) {
    return { ...arg, ...methods, providersStoreKey: 'ttsProviders' } as TtsProviderConfig<ID, S, D>;
}

export const availableTtsConfigs = [WebSpeechSynthesisApi] as const;
export type AvailableTtsConfigs = typeof availableTtsConfigs;
