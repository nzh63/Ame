/* eslint-disable @typescript-eslint/ban-types */
import type { Schema } from '@main/schema';
import type { SegmentProviderOptions, SegmentProviderMethods, SegmentProviderConfig } from '@main/providers/SegmentProvider';
import intlSegmenter from './intl-segmenter';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineSegmentProvider<
    ID extends string,
    S extends Schema,
    D,
    M extends { readonly [name: string]:() => any } = {}
>(
    arg: SegmentProviderOptions<ID, S, D>,
    methods: SegmentProviderMethods<ID, S, D, M>
): SegmentProviderConfig<ID, S, D, M> {
    return { ...arg, ...methods, providersStoreKey: 'segmentProviders' };
}

export const availableSegmentConfigs = [intlSegmenter] as const;
export type AvailableSegmentConfigs = typeof availableSegmentConfigs;
