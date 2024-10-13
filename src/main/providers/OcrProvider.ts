import type { BaseProviderMethods, BaseProviderOptions, Methods } from './BaseProvider';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/ocrProvider';
import type { Schema } from '@main/schema';
import type sharp from 'sharp';

export type OcrProviderMethods<ID extends string, S extends Schema, D, M extends Methods> = {
  recognize: (img: sharp.Sharp) => Promise<string> | string;
} & BaseProviderMethods<ID, S, D, M, OcrProvider<ID, S, D, M>>;

export type OcrProviderConfig<ID extends string, S extends Schema, D, M extends Methods> = BaseProviderOptions<
  ID,
  S,
  D
> &
  OcrProviderMethods<ID, S, D, M>;

// eslint-disable-next-line @typescript-eslint/ban-types
export class OcrProvider<
  ID extends string = string,
  S extends Schema = any,
  D = unknown,
  M extends Methods = {},
> extends BaseProvider<ID, S, D, M, OcrProviderConfig<ID, S, D, M>> {
  public static override readonly providersStoreKey = 'ocrProviders';
  public async recognize(img: sharp.Sharp): Promise<string> {
    logger(`${this.$id} recognize`);
    try {
      return await this.$config.recognize.call(this, img);
    } catch (e) {
      logger(`${this.$id} throw a error while calling the 'recognize' function, error: %O`, e);
      return Promise.reject(e);
    }
  }
}
