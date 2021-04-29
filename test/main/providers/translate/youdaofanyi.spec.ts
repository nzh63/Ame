import '../../env';
import youdaofanyi from '@main/providers/translate/youdaofanyi';
import { buildTest } from '.';

buildTest(youdaofanyi, {
    enable: true,
    fromLanguage: '日语',
    toLanguage: '中文'
}, !process.env.TEST_WEB);
