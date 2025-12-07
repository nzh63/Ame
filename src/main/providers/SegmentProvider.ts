import type { BaseProviderConfig, Methods } from './BaseProvider';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/SegmentProvider';
import type { Schema } from '@main/schema';

export type SegmentProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = {
  segment: (text: string) => Ame.Awaitable<(string | SegmentWord)[]>;
} & BaseProviderConfig<ID, S, D, M, BaseProvider<ID, S, D, M>>;

export interface SegmentWord {
  word: string;
  extraInfo?: string;
}

export class SegmentProvider<
  ID extends string = string,
  S extends Schema = any,
  D = unknown,
  M extends Methods = {},
> extends BaseProvider<ID, S, D, M, SegmentProviderConfig<ID, S, D, M>> {
  public static override readonly providersStoreKey = 'segmentProviders';
  public async segment(text: string): Promise<(string | SegmentWord)[]> {
    logger(`${this.$id} segment: %o`, text);
    try {
      const result = await this.$config.segment.call(this, text);
      logger(result);
      return result;
    } catch (e) {
      logger(`${this.$id} throw a error while calling the 'segment' function, error: %O`, e);
      return Promise.reject(e);
    }
  }
}
