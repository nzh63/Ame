import '../../env';
import qqfanyi from '@main/providers/translate/qqfanyi';
import { buildTest } from '.';

buildTest(qqfanyi, {
    enable: true,
    fromLanguage: '日语',
    toLanguage: '简体中文'
}, !process.env.TEST_WEB);
