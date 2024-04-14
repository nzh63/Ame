/* eslint-disable @typescript-eslint/ban-types */
import type { Schema } from '@main/schema';
import type { TranslateProviderConfig, TranslateProviderMethods } from '@main/providers/TranslateProvider';
import type { BaseProviderOptions, Methods } from '@main/providers/BaseProvider';
import echo from './echo';
import openai from './openai';
import tencentcloud from './tencentcloud';
import baiduAi from './baiduAi';
import qqfanyi from './qqfanyi';
import youdaofanyi from './youdaofanyi';
import baidufanyi from './baidufanyi';
import googleTranslate from './googleTranslate';
import JBeijing from './JBeijing';
import DrEye from './DrEye';

export function defineTranslateProvider<
    ID extends string,
    S extends Schema,
    D,
    M extends Methods = {}
>(
    arg: BaseProviderOptions<ID, S, D>,
    methods: TranslateProviderMethods<ID, S, D, M>
): TranslateProviderConfig<ID, S, D, M> {
    return { ...arg, ...methods };
}

export const availableTranslateConfigs = [...(import.meta.env.DEV ? [echo] : []), openai, tencentcloud, baiduAi, qqfanyi, youdaofanyi, baidufanyi, googleTranslate, JBeijing, DrEye] as const;
export type AvailableTranslateConfigs = typeof availableTranslateConfigs;
