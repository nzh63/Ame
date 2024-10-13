import { buildTest } from '.';
import '../../env';
import baidufanyi from '@main/providers/translate/baidufanyi';

buildTest(
  baidufanyi,
  {
    enable: true,
    fromLanguage: '日语',
    toLanguage: '中文(简体)',
  },
  !process.env.TEST_WEB,
);
