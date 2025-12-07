import type { BaseProviderConfig, Methods } from './BaseProvider';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/dictProvider';
import type { Schema } from '@main/schema';

export type DictProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = {
  query: (word: string) => Ame.Awaitable<void>;
} & BaseProviderConfig<ID, S, D, M, BaseProvider<ID, S, D, M>>;

export class DictProvider<
  ID extends string = string,
  S extends Schema = any,
  D = unknown,
  M extends Methods = {},
> extends BaseProvider<ID, S, D, M, DictProviderConfig<ID, S, D, M>> {
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
