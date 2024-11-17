import DrEye from './DrEye';
import JBeijing from './JBeijing';
import baiduAi from './baiduAi';
import baidufanyi from './baidufanyi';
import echo from './echo';
import googleTranslate from './googleTranslate';
import hunyuan from './hunyuan';
import openai from './openai';
import qqfanyi from './qqfanyi';
import tencentcloud from './tencentcloud';
import youdaofanyi from './youdaofanyi';
import type { Methods } from '@main/providers/BaseProvider';
import type { TranslateProviderConfig } from '@main/providers/TranslateProvider';
import type { Schema } from '@main/schema';

export function defineTranslateProvider<ID extends string, S extends Schema, D, M extends Methods = {}>(
  arg: TranslateProviderConfig<ID, S, D, M>,
) {
  return arg;
}

export const availableTranslateConfigs = [
  ...(import.meta.env.DEV ? [echo] : []),
  openai,
  hunyuan,
  tencentcloud,
  baiduAi,
  qqfanyi,
  youdaofanyi,
  baidufanyi,
  googleTranslate,
  JBeijing,
  DrEye,
] as const;
export type AvailableTranslateConfigs = typeof availableTranslateConfigs;
