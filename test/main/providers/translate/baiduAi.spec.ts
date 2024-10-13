import { buildTest } from '.';
import '../../env';
import baiduAi from '@main/providers/translate/baiduAi';

buildTest(
  baiduAi,
  {
    enable: true,
    apiConfig: {
      appid: process.env.TEST_PROVIDERS_TRANSLATE_BAIDUAI_APPID ?? null,
      key: process.env.TEST_PROVIDERS_TRANSLATE_BAIDUAI_KEY ?? null,
      fromLanguage: 'jp',
      toLanguage: 'zh',
    },
  },
  !process.env.TEST_PROVIDERS_TRANSLATE_BAIDUAI_APPID && !process.env.TEST_PROVIDERS_TRANSLATE_BAIDUAI_KEY,
);
