import type { StoreType } from '@main/store';
import { storeClear, storeDelete, storeGet, storeHas, storeReset, storeSet } from '@render/remote/store';

interface Store<T = StoreType['store']> {
    get<Key extends keyof T>(key: Key): Promise<T[Key]>;
    get<Key extends keyof T>(key: Key, defaultValue: Required<T>[Key]): Promise<Required<T>[Key]>;
    get<Key extends string, Value = unknown>(key: Exclude<Key, keyof T>, defaultValue?: Value): Promise<Value>;

    set<Key extends keyof T>(key: Key, value?: T[Key]): Promise<void>;
    set(key: string, value: unknown): Promise<void>;

    has<Key extends keyof T>(key: Key | string): Promise<boolean>;

    reset<Key extends keyof T>(...keys: Key[]): Promise<void>;

    delete<Key extends keyof T>(key: Key): Promise<void>;

    clear(): Promise<void>;
}

const store: Store = {
    get(key: string, defaultValue?: any) {
        return storeGet(key, defaultValue);
    },
    set(key: string, value?: any) {
        return storeSet(key, value);
    },
    has(key: string) {
        return storeHas(key);
    },
    reset(...keys: string[]) {
        return storeReset(...keys);
    },
    delete(key: string) {
        return storeDelete(key);
    },
    clear() {
        return storeClear();
    }
};

export default store;
