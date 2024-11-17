import WebSpeechSynthesisApi from './WebSpeechSynthesisApi';
import type { Methods } from '@main/providers/BaseProvider';
import type { TtsProviderConfig } from '@main/providers/TtsProvider';
import type { Schema } from '@main/schema';

export function defineTtsProvider<ID extends string, S extends Schema, D, M extends Methods = {}>(
  arg: TtsProviderConfig<ID, S, D, M>,
) {
  return arg;
}

export const availableTtsConfigs = [WebSpeechSynthesisApi] as const;
export type AvailableTtsConfigs = typeof availableTtsConfigs;
