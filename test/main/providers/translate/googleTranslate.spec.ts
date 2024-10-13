import { buildTest } from '.';
import '../../env';
import googleTranslate from '@main/providers/translate/googleTranslate';

buildTest(
  googleTranslate,
  {
    enable: true,
    fromLanguage: 'ja',
    toLanguage: 'zh-CN',
  },
  !process.env.TEST_WEB,
);
