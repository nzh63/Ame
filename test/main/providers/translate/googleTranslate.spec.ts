import '../../env';
import googleTranslate from '@main/providers/translate/googleTranslate';
import { buildTest } from '.';

buildTest(googleTranslate, {
    enable: true,
    fromLanguage: 'ja',
    toLanguage: 'zh-CN'
}, !process.env.TEST_WEB);
