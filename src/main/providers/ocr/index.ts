/* eslint-disable @typescript-eslint/ban-types */
import type { Schema } from '@main/schema';
import type { OcrProviderMethods, OcrProviderConfig } from '@main/providers/OcrProvider';
import type { BaseProviderOptions, Methods } from '@main/providers/BaseProvider';
import tesseract from './tesseract';
import tencentcloud from './tencentcloud';
import baiduAi from './baiduAi';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineOcrProvider<
    ID extends string,
    S extends Schema,
    D,
    M extends Methods = {}
>(
    arg: BaseProviderOptions<ID, S, D>,
    methods: OcrProviderMethods<ID, S, D, M>
): OcrProviderConfig<ID, S, D, M> {
    return { ...arg, ...methods };
}

export const availableOcrConfigs = [tesseract, tencentcloud, baiduAi] as const;
export type AvailableOcrConfigs = typeof availableOcrConfigs;
