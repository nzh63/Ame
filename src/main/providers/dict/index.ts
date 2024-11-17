import hujiang from './hujiang';
import youdao from './youdao';
import type { Methods } from '@main/providers/BaseProvider';
import type { DictProviderConfig } from '@main/providers/DictProvider';
import type { Schema } from '@main/schema';
import { shell } from 'electron';
import querystring from 'querystring';
import util from 'util';

export function defineDictProvider<ID extends string, S extends Schema, D, M extends Methods = {}>(
  arg: DictProviderConfig<ID, S, D, M>,
) {
  return arg;
}

export function defineExternalDictProvider<ID extends string>(id: ID, url: string) {
  return defineDictProvider({
    id,
    optionsSchema: null,
    defaultOptions: null,
    data() {
      return null;
    },
    isReady() {
      return true;
    },
    query(word) {
      return shell.openExternal(util.format(url, querystring.escape(word)));
    },
  });
}

export const availableDictConfigs = [youdao, hujiang] as const;
export type AvailableDictConfigs = typeof availableDictConfigs;
