import type { JSONSchema, Schema, SchemaDescription, SchemaType } from '@main/schema';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/ttsProvider';

export type TTSProviderOptions<ID extends string, S extends Schema, D> = {
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
};
export type TTSProviderMethods<ID extends string, S extends Schema, D> = {
    init?(this: TTSProvider<ID, S, D>): void | Promise<void>;
    isReady(this: TTSProvider<ID, S, D>): boolean;
    speak(this: TTSProvider<ID, S, D>, text: string, type: 'original' | 'translate'): Promise<void> | void;
    destroy?(this: TTSProvider<ID, S, D>): void;
    getOptionsJSONSchema?(this: TTSProvider<ID, S, D>): JSONSchema;
};

export type TTSProviderConfig<ID extends string, S extends Schema, D> = TTSProviderOptions<ID, S, D> & TTSProviderMethods<ID, S, D> & { providersStoreKey: 'ttsProviders' };

export class TTSProvider<ID extends string, S extends Schema = any, D = unknown> extends BaseProvider<ID, S, D, TTSProviderConfig<ID, S, D>> {
    public async speak(this: TTSProvider<ID, S, D>, text: string, type: 'original' | 'translate'): Promise<void> {
        logger(`${this.id} speak ${text} ${type}`);
        try {
            return await this.config.speak.call(this, text, type);
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'speak' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
