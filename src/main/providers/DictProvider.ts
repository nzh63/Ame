import type { Schema } from '@main/schema';
import { BaseProvider, BaseProviderMethods, BaseProviderOptions, Methods } from './BaseProvider';
import logger from '@logger/providers/dictProvider';

export type DictProviderMethods<ID extends string, S extends Schema, D, M extends Methods> = {
    query(word: string): Promise<void> | void;
} & BaseProviderMethods<ID, S, D, M, DictProvider<ID, S, D, M>>;

export type DictProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = BaseProviderOptions<ID, S, D> & DictProviderMethods<ID, S, D, M>;

// eslint-disable-next-line @typescript-eslint/ban-types
export class DictProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends Methods = {}> extends BaseProvider<ID, S, D, M, DictProviderConfig<ID, S, D, M>> {
    public static override readonly providersStoreKey = 'dictProviders';
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
