import '../../env';
import openai from '@main/providers/translate/openai';
import { buildTest } from '.';

buildTest(openai, {
    enable: true,
    apiConfig: {
        baseURL: process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_BASEURL ?? '',
        apiKey: process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY ?? '',
        organization: process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_ORGANIZATION ?? ''
    },
    chatConfig: {
        model: 'gpt-4',
        maxHistory: 100,
        systemPrompt: '请将用户输入的日文翻译为中文'
    }
}, !process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_BASEURL && !process.env.TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY);
