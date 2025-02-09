import { buildTest } from '.';
import '../../env';
import hunyuan from '@main/providers/translate/hunyuan';

buildTest(
  hunyuan,
  {
    enable: true,
    apiConfig: {
      credential: {
        secretId: process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_ID ?? null,
        secretKey: process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_KEY ?? null,
      },
    },
    chatConfig: {
      model: 'hunyuan-lite',
      maxHistory: 100,
      systemPrompt: '请将用户输入的日文翻译为中文',
    },
  },
  !process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_ID &&
    !process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_KEY,
);
