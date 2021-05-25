/* eslint-disable @typescript-eslint/ban-types */
import querystring from 'querystring';
import util from 'util';
import { shell } from 'electron';
import type { Schema } from '@main/schema';
import type { DictProviderOptions, DictProviderMethods, DictProviderConfig } from '@main/providers/DictProvider';
import youdao from './youdao';
import hujiang from './hujiang';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineDictProvider<
    ID extends string,
    S extends Schema,
    D,
    M extends { readonly [name: string]:() => any } = {}
>(
    arg: DictProviderOptions<ID, S, D>,
    methods: DictProviderMethods<ID, S, D, M>
): DictProviderConfig<ID, S, D, M> {
    return { ...arg, ...methods, providersStoreKey: 'dictProviders' };
}

export function defineExternalDictProvider<ID extends string>(id: ID, url: string) {
    return defineDictProvider({
        id,
        optionsSchema: null,
        defaultOptions: null,
        data() { return null; }
    }, {
        isReady() { return true; },
        query(word) {
            return shell.openExternal(util.format(url, querystring.escape(word)));
        }
    });
}

export const availableDictConfigs = [youdao, hujiang] as const;
export type AvailableDictConfigs = typeof availableDictConfigs;