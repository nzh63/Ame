import type { Schema } from '@main/schema';
import type { OcrProviderOptions, OcrProviderMethods, OcrProviderConfig } from '@main/providers/OcrProvider';
import tesseract from './tesseract';
import tencentcloud from './tencentcloud';
import baiduAi from './baiduAi';

export function defineOcrProvider<ID extends string, S extends Schema, D, M extends { readonly [name: string]:() => any }>(arg: OcrProviderOptions<ID, S, D>, methods: OcrProviderMethods<ID, S, D, M>) {
    return { ...arg, ...methods, providersStoreKey: 'ocrProviders' } as OcrProviderConfig<ID, S, D, M>;
}

export const availableOcrConfigs = [tesseract, tencentcloud, baiduAi] as const;
export type AvailableOcrConfigs = typeof availableOcrConfigs;
