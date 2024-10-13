import type { BaseProviderMethods, BaseProviderOptions, Methods } from './BaseProvider';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/SegmentProvider';
import type { Schema } from '@main/schema';

export type SegmentProviderMethods<ID extends string, S extends Schema, D, M extends Methods> = {
  segment: (text: string) => Promise<(string | SegmentWord)[]> | (string | SegmentWord)[];
} & BaseProviderMethods<ID, S, D, M, SegmentProvider<ID, S, D, M>>;

export type SegmentProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = BaseProviderOptions<
  ID,
  S,
  D
> &
  SegmentProviderMethods<ID, S, D, M>;

export interface SegmentWord {
  word: string;
  extraInfo?: string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
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
