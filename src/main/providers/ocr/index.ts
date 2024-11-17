import baiduAi from './baiduAi';
import tencentcloud from './tencentcloud';
import tesseract from './tesseract';
import type { Methods } from '@main/providers/BaseProvider';
import type { OcrProviderConfig } from '@main/providers/OcrProvider';
import type { Schema } from '@main/schema';

export function defineOcrProvider<ID extends string, S extends Schema, D, M extends Methods = {}>(
  arg: OcrProviderConfig<ID, S, D, M>,
) {
  return arg;
}

export const availableOcrConfigs = [tesseract, tencentcloud, baiduAi] as const;
export type AvailableOcrConfigs = typeof availableOcrConfigs;
