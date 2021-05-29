import type { Schema } from '@main/schema';
import { BaseProvider, BaseProviderMethods, BaseProviderOptions, Methods } from './BaseProvider';
import logger from '@logger/providers/ttsProvider';

export type TtsProviderMethods<ID extends string, S extends Schema, D, M extends Methods> = {
    speak(text: string, type: 'original' | 'translate'): Promise<void> | void;
} & BaseProviderMethods<ID, S, D, M, TtsProvider<ID, S, D, M>>;

export type TtsProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = BaseProviderOptions<ID, S, D> & TtsProviderMethods<ID, S, D, M> & { providersStoreKey: 'ttsProviders' };

// eslint-disable-next-line @typescript-eslint/ban-types
export class TtsProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends Methods = {}> extends BaseProvider<ID, S, D, M, TtsProviderConfig<ID, S, D, M>> {
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
