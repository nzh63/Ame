import { buildTest } from '.';
import '../../env';
import qqfanyi from '@main/providers/translate/qqfanyi';

buildTest(
  qqfanyi,
  {
    enable: true,
    fromLanguage: '日语',
    toLanguage: '简体中文',
  },
  !process.env.TEST_WEB,
);
