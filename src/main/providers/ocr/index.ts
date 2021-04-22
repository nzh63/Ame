import type { Schema } from '@main/schema';
import type { OcrProviderOptions, OcrProviderMethods, OcrProviderConfig } from '@main/providers/OcrProvider';
import tesseract from './tesseract';
import baiduAi from './baiduAi';

export function defineOcrProvider<ID extends string, S extends Schema, D>(arg: OcrProviderOptions<ID, S, D>, methods: OcrProviderMethods<ID, S, D>) {
    return { ...arg, ...methods, providersStoreKey: 'ocrProviders' } as OcrProviderConfig<ID, S, D>;
}

export const availableOcrConfigs = [tesseract, baiduAi] as const;
export type AvailableOcrConfigs = typeof availableOcrConfigs;
