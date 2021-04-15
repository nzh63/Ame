import type { nativeImage } from 'electron';
import type { JSONSchema, Schema, SchemaDescription, SchemaType } from '@main/schema';
import { BaseProvider } from './BaseProvider';
import logger from '@logger/providers/ocrProvider';

export type OCRProviderOptions<ID extends string, S extends Schema, D> = {
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
};
export type OCRProviderMethods<ID extends string, S extends Schema, D> = {
    init?(this: OCRProvider<ID, S, D>): void;
    isReady(this: OCRProvider<ID, S, D>): boolean;
    recognize(this: OCRProvider<ID, S, D>, img: nativeImage): Promise<string> | string;
    destroy?(this: OCRProvider<ID, S, D>): void;
    getOptionsJSONSchema?(this: OCRProvider<ID, S, D>): JSONSchema;
};

export type OCRProviderConfig<ID extends string, S extends Schema, D> = OCRProviderOptions<ID, S, D> & OCRProviderMethods<ID, S, D> & { providersStoreKey: 'ocrProviders' };

export class OCRProvider<ID extends string, S extends Schema = any, D = unknown> extends BaseProvider<ID, S, D, OCRProviderConfig<ID, S, D>> {
    public async recognize(this: OCRProvider<ID, S, D>, img: nativeImage): Promise<string> {
        logger(`${this.id} recognize %O`, img.getSize());
        try {
            return await this.config.recognize.call(this, img);
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'recognize' function, error: %O`, e);
            return Promise.reject(e);
        }
    }
}
