import type { Schema, SchemaDescription, SchemaType } from '@main/schema';
import { BaseProvider, ProviderThisType } from './BaseProvider';
import logger from '@logger/providers/SegmentProvider';

export type SegmentProviderOptions<ID extends string, S extends Schema, D> = {
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
};
export type SegmentProviderMethods<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = {
    init?(): void | Promise<void>;
    isReady(): boolean;
    segment(text: string): Promise<string[]> | string[];
    destroy?(): void;
    methods?: M & ProviderThisType<SegmentProvider<ID, S, D, M>>;
} & ProviderThisType<SegmentProvider<ID, S, D, M>>;

export type SegmentProviderConfig<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = SegmentProviderOptions<ID, S, D> & SegmentProviderMethods<ID, S, D, M> & { providersStoreKey: 'segmentProviders' };

// eslint-disable-next-line @typescript-eslint/ban-types
export class SegmentProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends { readonly [name: string]: () => unknown } = {}> extends BaseProvider<ID, S, D, M, SegmentProviderConfig<ID, S, D, M>> {
    public async segment(text: string): Promise<string[]> {
        logger(`${this.$id} segment: %o`, text);
        try {
            const result = await this.$config.segment.call(this, text);
            logger(result);
            return result;
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'segment' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
