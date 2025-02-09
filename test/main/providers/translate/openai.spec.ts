import { buildTest } from '.';
import '../../env';
import openai from '@main/providers/translate/openai';

buildTest(
  openai,
  {
    enable: true,
    apiConfig: {
      baseURL: process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_BASEURL ?? '',
      apiKey: process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY ?? '',
      organization: process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_ORGANIZATION ?? '',
    },
    chatConfig: {
      model: 'deepseek-r1',
      maxHistory: 100,
      systemPrompt: '请将用户输入的日文翻译为中文',
      showReasoning: true,
    },
  },
  !process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_BASEURL && !process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY,
);
