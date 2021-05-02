import type { Schema, SchemaDescription, SchemaType } from '@main/schema';
import { BaseProvider, ProviderThisType } from './BaseProvider';
import logger from '@logger/providers/ttsProvider';

export type TtsProviderOptions<ID extends string, S extends Schema, D> = {
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
};
export type TtsProviderMethods<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = {
    init?(): void | Promise<void>;
    isReady(): boolean;
    speak(text: string, type: 'original' | 'translate'): Promise<void> | void;
    destroy?(): void;
    methods?: M & ProviderThisType<TtsProvider<ID, S, D, M>>;
} & ProviderThisType<TtsProvider<ID, S, D, M>>;

export type TtsProviderConfig<ID extends string, S extends Schema, D, M extends { readonly [name: string]: () => unknown }> = TtsProviderOptions<ID, S, D> & TtsProviderMethods<ID, S, D, M> & { providersStoreKey: 'ttsProviders' };

// eslint-disable-next-line @typescript-eslint/ban-types
export class TtsProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends { readonly [name: string]: () => unknown } = {}> extends BaseProvider<ID, S, D, M, TtsProviderConfig<ID, S, D, M>> {
    public async speak(text: string, type: 'original' | 'translate'): Promise<void> {
        logger(`${this.$id} speak ${text} ${type}`);
        try {
            return await this.$config.speak.call(this, text, type);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'speak' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
