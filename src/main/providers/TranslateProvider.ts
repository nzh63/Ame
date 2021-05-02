import type { SchemaType, SchemaDescription, Schema } from '@main/schema';
import { BaseProvider, ProviderThisType } from './BaseProvider';
import logger from '@logger/providers/translateProvider';

export type TranslateProviderOptions<ID extends string, S extends Schema, D> = {
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
};
export type TranslateProviderMethods<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = {
    init?(): void | Promise<void>;
    isReady(): boolean;
    translate(text: string): Promise<string> | string;
    destroy?(): void;
    methods?: M & ProviderThisType<TranslateProvider<ID, S, D, M>>;
} & ProviderThisType<TranslateProvider<ID, S, D, M>>;

export type TranslateProviderConfig<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = TranslateProviderOptions<ID, S, D> & TranslateProviderMethods<ID, S, D, M> & { providersStoreKey: 'translateProviders' };

// eslint-disable-next-line @typescript-eslint/ban-types
export class TranslateProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends { readonly [name: string]: () => unknown } = {}> extends BaseProvider<ID, S, D, M, TranslateProviderConfig<ID, S, D, M>> {
    public async translate(text: string): Promise<string> {
        try {
            return await this.$config.translate.call(this, text);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'translate' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
