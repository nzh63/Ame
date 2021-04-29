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
export type TtsProviderMethods<ID extends string, S extends Schema, D> = {
    init?(): void | Promise<void>;
    isReady(): boolean;
    speak(text: string, type: 'original' | 'translate'): Promise<void> | void;
    destroy?(): void;
} & ProviderThisType<TtsProvider<ID, S, D>>;

export type TtsProviderConfig<ID extends string, S extends Schema, D> = TtsProviderOptions<ID, S, D> & TtsProviderMethods<ID, S, D> & { providersStoreKey: 'ttsProviders' };

export class TtsProvider<ID extends string = string, S extends Schema = any, D = unknown> extends BaseProvider<ID, S, D, TtsProviderConfig<ID, S, D>> {
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
