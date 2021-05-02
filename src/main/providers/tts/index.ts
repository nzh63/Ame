import type { Schema } from '@main/schema';
import type { TtsProviderOptions, TtsProviderMethods, TtsProviderConfig } from '@main/providers/TtsProvider';
import WebSpeechSynthesisApi from './WebSpeechSynthesisApi';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineTtsProvider<ID extends string, S extends Schema, D, M extends { readonly [name: string]:() => any } = {}>(arg: TtsProviderOptions<ID, S, D>, methods: TtsProviderMethods<ID, S, D, M>) {
    return { ...arg, ...methods, providersStoreKey: 'ttsProviders' } as TtsProviderConfig<ID, S, D, M>;
}

export const availableTtsConfigs = [WebSpeechSynthesisApi] as const;
export type AvailableTtsConfigs = typeof availableTtsConfigs;
