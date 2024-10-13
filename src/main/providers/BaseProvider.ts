/* eslint-disable @typescript-eslint/ban-types */
import logger from '@logger/providers/baseProvider';
import type { Schema, SchemaDescription, SchemaType, JSONSchema } from '@main/schema';
import { toJSONSchema } from '@main/schema';
import store from '@main/store';
import { defaultsDeep } from 'lodash-es';

export interface BaseProviderOptions<ID extends string = string, S extends Schema = any, D = unknown> {
  id: ID;
  optionsSchema: S;
  defaultOptions: SchemaType<S>;
  optionsDescription?: SchemaDescription<S>;
  description?: string;
  data: (this: undefined) => D;
}
export interface Methods {
  readonly [name: string]: () => unknown;
}
export type BaseProviderMethods<
  ID extends string,
  S extends Schema,
  D,
  M extends Methods,
  P extends BaseProvider<ID, S, D, M>,
> = {
  init?: () => void | Promise<void>;
  isReady?: () => boolean;
  destroy?: () => void;
  methods?: M & ProviderThisType<P>;
} & ProviderThisType<P>;
export type BaseProviderConfig<
  ID extends string = string,
  S extends Schema = any,
  D = unknown,
  M extends Methods = {},
> = BaseProviderOptions<ID, S, D> & BaseProviderMethods<ID, S, D, M, BaseProvider<ID, S, D, M>>;

export type ProviderThisType<P extends BaseProvider> = ThisType<
  P &
    Omit<P['$options'], keyof P> &
    Omit<P['$data'], keyof P | keyof P['$options']> &
    Omit<P['$methods'], keyof P | keyof P['$options'] | keyof P['$data']>
>;
export class BaseProvider<
  ID extends string = string,
  S extends Schema = any,
  D = unknown,
  M extends Methods = {},
  C extends BaseProviderConfig<ID, S, D, M> = BaseProviderConfig<ID, S, D, M>,
> {
  #destroyed = false;
  public static readonly providersStoreKey: string;
  public readonly $id: ID;
  public readonly $optionsSchema: S;
  public readonly $options: SchemaType<S>;
  public $data: D;
  public $methods: M;

  public constructor(
    public readonly $config: C,
    getStoreOptions: () => SchemaType<S> = () =>
      store.get<string, SchemaType<S>>(`${(this.constructor as typeof BaseProvider).providersStoreKey}.${$config.id}`),
  ) {
    this.$id = $config.id;
    this.$optionsSchema = $config.optionsSchema;
    this.$options = getStoreOptions();
    this.$options = defaultsDeep(this.$options, $config.defaultOptions);
    this.$data = $config.data.call(undefined);
    this.$methods = { ...($config.methods ?? ({} as M)) };
    for (const i in this.$methods) {
      if (!Object.hasOwn(this.$methods, i)) continue;
      this.$methods[i] = this.$methods[i].bind(this) as M[Extract<keyof M, string>];
    }
    this.#bindData(this.$options);
    this.#bindData(this.$data);
    this.#bindData(this.$methods);
    logger({ id: this.$id, options: this.$options });
    try {
      const initRet = $config.init?.call(this);
      if (initRet instanceof Promise) {
        this.whenInitDone = () => initRet;
        initRet.catch((e) => logger(`${this.$id} throw a error while calling the async 'init' function, error: %O`, e));
      }
    } catch (e) {
      logger(`${this.$id} throw a error while calling the 'init' function, error: %O`, e);
    }
  }

  public whenInitDone = () => Promise.resolve();

  #bindData(data: any) {
    if (data !== null && typeof data === 'object') {
      for (const i in data) {
        if (!(i in this)) {
          Object.defineProperty(this, i, {
            get: () => data[i],
            set: (v) => {
              data[i] = v;
            },
          });
        }
      }
    }
  }

  public isReady(): boolean {
    try {
      return this.$config.isReady?.call(this) ?? true;
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
