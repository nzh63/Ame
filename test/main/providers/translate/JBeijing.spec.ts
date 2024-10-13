import { buildTest } from '.';
import '../../env';
import JBeijing from '@main/providers/translate/JBeijing';

buildTest(
  JBeijing,
  {
    enable: true,
    path: {
      dll: process.env.TEST_PROVIDERS_TRANSLATE_JBEIJING_DLL ?? null,
      userDicts: [],
    },
  },
  !process.env.TEST_PROVIDERS_TRANSLATE_JBEIJING_DLL,
);
