/* eslint-disable @typescript-eslint/ban-types */
import type { Schema } from '@main/schema';
import type { DictProviderMethods, DictProviderConfig } from '@main/providers/DictProvider';
import type { BaseProviderOptions, Methods } from '@main/providers/BaseProvider';
import querystring from 'querystring';
import util from 'util';
import { shell } from 'electron';
import youdao from './youdao';
import hujiang from './hujiang';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineDictProvider<
    ID extends string,
    S extends Schema,
    D,
    M extends Methods = {}
>(
    arg: BaseProviderOptions<ID, S, D>,
    methods: DictProviderMethods<ID, S, D, M>
): DictProviderConfig<ID, S, D, M> {
    return { ...arg, ...methods };
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
