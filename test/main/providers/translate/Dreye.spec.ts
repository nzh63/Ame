import { buildTest } from '.';
import '../../env';
import DrEye from '@main/providers/translate/DrEye';

buildTest(
  DrEye,
  {
    enable: true,
    path: {
      dllTransCOM: process.env.TEST_PROVIDERS_TRANSLATE_DREYE_DLL_TRANS_COM ?? null,
      dllTransCOMEC: null,
    },
    translateType: '日->中',
  },
  !process.env.TEST_PROVIDERS_TRANSLATE_DREYE_DLL_TRANS_COM,
);
