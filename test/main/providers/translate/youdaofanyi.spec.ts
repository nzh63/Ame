import { buildTest } from '.';
import '../../env';
import youdaofanyi from '@main/providers/translate/youdaofanyi';

buildTest(
  youdaofanyi,
  {
    enable: true,
    fromLanguage: '日语',
    toLanguage: '中文',
  },
  !process.env.TEST_WEB,
);
