import intlSegmenter from './intl-segmenter';
import mecab from './mecab';
import type { Methods } from '@main/providers/BaseProvider';
import type { SegmentProviderConfig } from '@main/providers/SegmentProvider';
import type { Schema } from '@main/schema';

export function defineSegmentProvider<ID extends string, S extends Schema, D, M extends Methods = {}>(
  arg: SegmentProviderConfig<ID, S, D, M>,
) {
  return arg;
}

export const availableSegmentConfigs = [intlSegmenter, mecab] as const;
export type AvailableSegmentConfigs = typeof availableSegmentConfigs;
