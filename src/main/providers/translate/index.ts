import type { Schema } from '@main/schema';
import type { TranslateProviderConfig, TranslateProviderMethods, TranslateProviderOptions } from '@main/providers/TranslateProvider';
import echo from './echo';
import tencentcloud from './tencentcloud';
import baiduAi from './baiduAi';
import qqfanyi from './qqfanyi';
import youdaofanyi from './youdaofanyi';
import baidufanyi from './baidufanyi';
import googleTranslate from './googleTranslate';
import JBeijing from './JBeijing';
import DrEye from './DrEye';

// eslint-disable-next-line @typescript-eslint/ban-types
export function defineTranslateProvider<ID extends string, S extends Schema, D, M extends { readonly [name: string]:() => any } = {}>(arg: TranslateProviderOptions<ID, S, D>, methods: TranslateProviderMethods<ID, S, D, M>) {
    return { ...arg, ...methods, providersStoreKey: 'translateProviders' } as TranslateProviderConfig<ID, S, D, M>;
}

export const availableTranslateConfigs = [...(import.meta.env.DEV ? [echo] : []), tencentcloud, baiduAi, qqfanyi, youdaofanyi, baidufanyi, googleTranslate, JBeijing, DrEye] as const;
export type AvailableTranslateConfigs = typeof availableTranslateConfigs;
