import { Schema, SchemaDescription, SchemaType, JSONSchema, toJSONSchema } from '@main/schema';
import { defaultsDeep } from 'lodash-es';
import store from '@main/store';
import logger from '@logger/providers/baseProvider';

// eslint-disable-next-line @typescript-eslint/ban-types
export type BaseProviderConfig<ID extends string = string, S extends Schema = any, D = unknown, M extends { readonly [name: string]: () => unknown } = {}> = {
    providersStoreKey: string;
    id: ID;
    optionsSchema: S;
    defaultOptions: SchemaType<S>;
    optionsDescription?: SchemaDescription<S>;
    description?: string;
    data(): D;
    init?(): void | Promise<void>;
    isReady(): boolean;
    destroy?(): void;
    methods?: M & ProviderThisType<BaseProvider<ID, S, D, M>>;
} & ProviderThisType<BaseProvider<ID, S, D, M>>;

export type ProviderThisType<P extends BaseProvider> = ThisType<P & Omit<P['$options'], keyof P> & Omit<P['$data'], keyof P> & Omit<P['$methods'], keyof P>>;
// eslint-disable-next-line @typescript-eslint/ban-types
export class BaseProvider<ID extends string = string, S extends Schema = any, D = unknown, M extends { readonly [name: string]: () => unknown } = {}, C extends BaseProviderConfig<ID, S, D, M> = BaseProviderConfig<ID, S, D, M>> {
    public readonly $id: ID;
    public readonly $optionsSchema: S;
    public readonly $options: SchemaType<S>;
    public $data: D;
    public $methods: M;
    public whenInitDone = () => Promise.resolve();
    #destroyed = false;
    constructor(
        public readonly $config: C,
        getStoreOptions = () => store.get<string, SchemaType<S>>(`${$config.providersStoreKey}.${$config.id as ID}`)
    ) {
        this.$id = $config.id;
        this.$optionsSchema = $config.optionsSchema;
        this.$options = getStoreOptions();
        this.$options = defaultsDeep(this.$options, $config.defaultOptions);
        this.$data = $config.data();
        this.$methods = { ...($config.methods ?? {} as M) };
        for (const i in this.$methods) {
            this.$methods[i] = this.$methods[i].bind(this) as M[Extract<keyof M, string>];
        }
        this.bindData(this.$options);
        this.bindData(this.$data);
        this.bindData(this.$methods);
        logger({ id: this.$id, options: this.$options });
        try {
            const initRet = $config.init?.call(this);
            if (initRet instanceof Promise) {
                this.whenInitDone = () => initRet;
                initRet.catch(e => logger(`${this.$id} throw a error while calling the async 'init' function, error: %O`, e));
            }
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'init' function, error: %O`, e);
        }
    }

    private bindData(data: any) {
        if (data !== null && typeof data === 'object') {
            for (const i in data) {
                if (!(i in this)) {
                    Object.defineProperty(this, i, {
                        get: () => data[i],
                        set: (v) => { data[i] = v; }
                    });
                }
            }
        }
    }

    public isReady(): boolean {
        try {
            return this.$config.isReady.call(this);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'enable' function, disable it, error: %O`, e);
            return false;
        }
    }

    public destroy(): void {
        try {
            return this.$config.destroy?.call(this);
        } catch (e) {
            logger(`${this.$id} throw a error while calling the 'destroy' function, error: %O`, e);
        }
        this.#destroyed = true;
    }

    public get optionsJSONSchema(): JSONSchema {
        return toJSONSchema(this.$optionsSchema, this.$config.defaultOptions);
    }

    public isDestroyed() {
        return this.#destroyed;
    }
}
