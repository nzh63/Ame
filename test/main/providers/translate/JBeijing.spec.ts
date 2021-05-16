import '../../env';
import JBeijing from '@main/providers/translate/JBeijing';
import { buildTest } from '.';

buildTest(JBeijing, {
    enable: true,
    path: {
        dll: process.env.TEST_PROVIDERS_TRANSLATE_JBEIJING_DLL ?? null,
        userDicts: []
    }
}, !process.env.TEST_PROVIDERS_TRANSLATE_JBEIJING_DLL);
