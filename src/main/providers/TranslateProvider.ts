import type { Schema } from '@main/schema';
import { BaseProvider, BaseProviderMethods, BaseProviderOptions, Methods } from './BaseProvider';
import logger from '@logger/providers/translateProvider';

export type TranslateProviderMethods<ID extends string, S extends Schema, D, M extends Methods> = {
    translate(text: string): Promise<string> | string;
} & BaseProviderMethods<ID, S, D, M, TranslateProvider<ID, S, D, M>>;

export type TranslateProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = BaseProviderOptions<ID, S, D> & TranslateProviderMethods<ID, S, D, M> & { providersStoreKey: 'translateProviders' };

// eslint-disable-next-line @typescript-eslint/ban-types
export class TranslateProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends Methods = {}> extends BaseProvider<ID, S, D, M, TranslateProviderConfig<ID, S, D, M>> {
    public async translate(text: string): Promise<string> {
        try {
            return await this.$config.translate.call(this, text);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'translate' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
