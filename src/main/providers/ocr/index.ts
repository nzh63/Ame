import type { Schema } from '@main/schema';
import type { OCRProviderOptions, OCRProviderMethods, OCRProviderConfig } from '@main/providers/OCRProvider';
import tesseract from './tesseract';
import baiduAi from './baiduAi';

export function defineOCRProvider<ID extends string, S extends Schema, D>(arg: OCRProviderOptions<ID, S, D>, methods: OCRProviderMethods<ID, S, D>) {
    return { ...arg, ...methods, providersStoreKey: 'ocrProviders' } as OCRProviderConfig<ID, S, D>;
}

export const availableOCRConfigs = [tesseract, baiduAi] as const;
export type AvailableOCRConfigs = typeof availableOCRConfigs;
