import type { BaseProviderConfig, Methods } from './BaseProvider';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/translateProvider';
import type { Schema } from '@main/schema';

export type TranslateProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = {
  translate: (text: string) => Ame.Awaitable<string | Generator<string> | AsyncGenerator<string>>;
} & BaseProviderConfig<ID, S, D, M, TranslateProvider<ID, S, D, M>>;

export class TranslateProvider<
  ID extends string = string,
  S extends Schema = any,
  D = unknown,
  M extends Methods = {},
> extends BaseProvider<ID, S, D, M, TranslateProviderConfig<ID, S, D, M>> {
  public static override readonly providersStoreKey = 'translateProviders';
  public async translate(text: string): Promise<string | Generator<string> | AsyncGenerator<string>> {
    try {
      return await this.$config.translate.call(this, text);
    } catch (e) {
      logger(`${this.$id} throw a error while calling the 'translate' function, error: %O`, e);
      return Promise.reject(e);
    }
  }
}
