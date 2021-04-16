import { Schema, SchemaDescription, SchemaType, JSONSchema, toJSONSchema } from '@main/schema';
import store from '@main/store';
import logger from '@logger/providers/baseProvider';

export type BaseProviderConfig<ID extends string, S extends Schema = Record<string, any>, D = unknown> = {
    providersStoreKey: string;
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
    init?(this: BaseProvider<ID, S, D>): void;
    isReady(this: BaseProvider<ID, S, D>): boolean;
    destroy?(this: BaseProvider<ID, S, D>): void;
    getOptionsJSONSchema?(this: BaseProvider<ID, S, D>): JSONSchema;
};

export class BaseProvider<ID extends string, S extends Schema, D = unknown, C extends BaseProviderConfig<ID, S, D> = BaseProviderConfig<ID, S, D>> {
    public readonly id: ID;
    public readonly optionsSchema: S;
    public readonly options: SchemaType<S>;
    public data: D;
    constructor(
        public readonly config: C
    ) {
        this.id = config.id;
        this.optionsSchema = config.optionsSchema;
        const storeOptions = store.get<string, SchemaType<S>>(`${config.providersStoreKey}.${config.id as ID}`);
        if (storeOptions !== undefined) {
            if (storeOptions !== null && typeof storeOptions === 'object') {
                this.options = { ...config.defaultOptions, ...storeOptions };
            } else {
                this.options = storeOptions;
            }
        } else {
            this.options = config.defaultOptions;
        }
        logger({ id: this.id, storeOptions, defaultOptions: config.defaultOptions });
        this.data = config.data();
        try {
            config.init?.call(this);
        } catch (e) {
            logger(`${this.id} throw a error while calling the 'init' function, disable it, error: %O`, e);
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
        if (this.config.getOptionsJSONSchema) {
            return this.config.getOptionsJSONSchema.call(this);
        } else {
            return toJSONSchema(this.optionsSchema, this.config.defaultOptions);
        }
    }
}
