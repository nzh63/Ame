import { buildTest } from '.';
import '../../env';
import anthropic from '@main/providers/translate/anthropic';

buildTest(
  anthropic,
  {
    enable: true,
    apiConfig: {
      baseURL: process.env.TEST_PROVIDERS_TRANSLATE_ANTHROPIC_BASEURL ?? '',
      apiKey: process.env.TEST_PROVIDERS_TRANSLATE_ANTHROPIC_API_KEY ?? '',
      authToken: process.env.TEST_PROVIDERS_TRANSLATE_ANTHROPIC_AUTH_TOKEN ?? '',
    },
    chatConfig: {
      model: 'claude-opus-4-7',
      maxHistory: 30,
      maxTokens: 4096,
      systemPrompt: '请将用户输入的日文翻译为中文',
      thinkingType: 'adaptive',
      thinkingBudgetTokens: 1024,
      outputEffort: 'max',
      cacheControl: true,
    },
  },
  !process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_BASEURL &&
    (!process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY || !process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_AUTH_TOKEN),
);
