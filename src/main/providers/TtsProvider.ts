import type { Schema, SchemaDescription, SchemaType } from '@main/schema';
import { BaseProvider } from './BaseProvider';
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
    init?(this: TtsProvider<ID, S, D>): void | Promise<void>;
    isReady(this: TtsProvider<ID, S, D>): boolean;
    speak(this: TtsProvider<ID, S, D>, text: string, type: 'original' | 'translate'): Promise<void> | void;
    destroy?(this: TtsProvider<ID, S, D>): void;
};

export type TtsProviderConfig<ID extends string, S extends Schema, D> = TtsProviderOptions<ID, S, D> & TtsProviderMethods<ID, S, D> & { providersStoreKey: 'ttsProviders' };

export class TtsProvider<ID extends string = string, S extends Schema = any, D = unknown> extends BaseProvider<ID, S, D, TtsProviderConfig<ID, S, D>> {
    public async speak(this: TtsProvider<ID, S, D>, text: string, type: 'original' | 'translate'): Promise<void> {
        logger(`${this.id} speak ${text} ${type}`);
        try {
            return await this.config.speak.call(this, text, type);
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'speak' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
