import type { StoreType } from '@main/store';
import { storeClear, storeDelete, storeGet, storeHas, storeReset, storeSet } from '@remote/store';

interface Store<T = StoreType['store']> {
  get: (<Key extends keyof T>(key: Key) => Promise<T[Key]>) &
    (<Key extends keyof T>(key: Key, defaultValue: Required<T>[Key]) => Promise<Required<T>[Key]>) &
    (<Key extends string, Value = unknown>(key: Exclude<Key, keyof T>, defaultValue?: Value) => Promise<Value>);

  set: (<Key extends keyof T>(key: Key, value?: T[Key]) => Promise<void>) &
    ((key: string, value: unknown) => Promise<void>);

  has: <Key extends keyof T>(key: Key | string) => Promise<boolean>;

  reset: <Key extends keyof T>(...keys: Key[]) => Promise<void>;

  delete: <Key extends keyof T>(key: Key) => Promise<void>;

  clear: () => Promise<void>;
}

const store: Store = {
  get(key: any, defaultValue?: any): any {
    return storeGet(key, defaultValue);
  },
  set(key: any, value?: any): any {
    return storeSet(key, value);
  },
  has(key: any): any {
    return storeHas(key);
  },
  reset(...keys: any[]): any {
    return storeReset(...keys);
  },
  delete(key: any): any {
    return storeDelete(key);
  },
  clear(): any {
    return storeClear();
  },
};

export default store;
