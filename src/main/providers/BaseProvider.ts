import { Schema, SchemaDescription, SchemaType, JSONSchema, toJSONSchema } from '@main/schema';
import { defaultsDeep } from 'lodash-es';
import store from '@main/store';
import logger from '@logger/providers/baseProvider';

export type BaseProviderConfig<ID extends string = string, S extends Schema = any, D = unknown> = {
    providersStoreKey: string;
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
    init?(this: BaseProvider<ID, S, D>): void | Promise<void>;
    isReady(this: BaseProvider<ID, S, D>): boolean;
    destroy?(this: BaseProvider<ID, S, D>): void;
};

export class BaseProvider<ID extends string = string, S extends Schema = any, D = unknown, C extends BaseProviderConfig<ID, S, D> = BaseProviderConfig<ID, S, D>> {
    public readonly id: ID;
    public readonly optionsSchema: S;
    public readonly options: SchemaType<S>;
    public data: D;
    constructor(
        public readonly config: C
    ) {
        this.id = config.id;
        this.optionsSchema = config.optionsSchema;
        this.options = store.get<string, SchemaType<S>>(`${config.providersStoreKey}.${config.id as ID}`);
        this.options = defaultsDeep(this.options, config.defaultOptions);
        logger({ id: this.id, options: this.options });
        this.data = config.data();
        try {
            const initRet = config.init?.call(this);
            if (initRet instanceof Promise) {
                initRet.catch(e => logger(`${this.id} throw a error while calling the async 'init' function, error: %O`, e));
            }
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'init' function, error: %O`, e);
        }
    }

    public isReady(): boolean {
        try {
            return this.config.isReady.call(this);
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'enable' function, disable it, error: %O`, e);
            return false;
        }
    }

    public destroy(): void {
        try {
            return this.config.destroy?.call(this);
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'destroy' function, error: %O`, e);
        }
    }

    public get optionsJSONSchema(): JSONSchema {
        return toJSONSchema(this.optionsSchema, this.config.defaultOptions);
    }
}
