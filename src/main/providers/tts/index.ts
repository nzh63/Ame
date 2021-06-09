/* eslint-disable @typescript-eslint/ban-types */
import type { Schema } from '@main/schema';
import type { TtsProviderMethods, TtsProviderConfig } from '@main/providers/TtsProvider';
import type { BaseProviderOptions, Methods } from '@main/providers/BaseProvider';
import WebSpeechSynthesisApi from './WebSpeechSynthesisApi';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineTtsProvider<
    ID extends string,
    S extends Schema,
    D,
    M extends Methods = {}
>(
    arg: BaseProviderOptions<ID, S, D>,
    methods: TtsProviderMethods<ID, S, D, M>
): TtsProviderConfig<ID, S, D, M> {
    return { ...arg, ...methods };
}

export const availableTtsConfigs = [WebSpeechSynthesisApi] as const;
export type AvailableTtsConfigs = typeof availableTtsConfigs;
