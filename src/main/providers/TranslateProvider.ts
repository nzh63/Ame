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
export type TranslateProviderMethods<ID extends string, S extends Schema, D> = {
    init?(): void | Promise<void>;
    isReady(): boolean;
    translate(text: string): Promise<string> | string;
    destroy?(): void;
} & ProviderThisType<TranslateProvider<ID, S, D>>;

export type TranslateProviderConfig<ID extends string, S extends Schema, D> = TranslateProviderOptions<ID, S, D> & TranslateProviderMethods<ID, S, D> & { providersStoreKey: 'translateProviders' };

export class TranslateProvider<ID extends string = string, S extends Schema = any, D = unknown> extends BaseProvider<ID, S, D, TranslateProviderConfig<ID, S, D>> {
    public async translate(text: string): Promise<string> {
        try {
            return await this.$config.translate.call(this, text);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'translate' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
