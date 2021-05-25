import type { Schema, SchemaDescription, SchemaType } from '@main/schema';
import { BaseProvider, ProviderThisType } from './BaseProvider';
import logger from '@logger/providers/dictProvider';

export type DictProviderOptions<ID extends string, S extends Schema, D> = {
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
};
export type DictProviderMethods<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = {
    init?(): void | Promise<void>;
    isReady(): boolean;
    query(word: string): Promise<void> | void;
    destroy?(): void;
    methods?: M & ProviderThisType<DictProvider<ID, S, D, M>>;
} & ProviderThisType<DictProvider<ID, S, D, M>>;

export type DictProviderConfig<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = DictProviderOptions<ID, S, D> & DictProviderMethods<ID, S, D, M> & { providersStoreKey: 'dictProviders' };

// eslint-disable-next-line @typescript-eslint/ban-types
export class DictProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends { readonly [name: string]: () => unknown } = {}> extends BaseProvider<ID, S, D, M, DictProviderConfig<ID, S, D, M>> {
    public async query(text: string): Promise<void> {
        logger(`${this.$id} query ${text}`);
        try {
            return await this.$config.query.call(this, text);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'query' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
