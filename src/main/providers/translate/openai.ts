import { defineTranslateProvider } from '@main/providers/translate';
import { TaskQueue } from '@main/utils';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/index';

export default defineTranslateProvider({
  id: 'OpenAI-Compatible API',
  description:
    '你可能对以下链接感兴趣：\nhttps://platform.openai.com/docs/api-reference\nhttps://github.com/ggerganov/llama.cpp/blob/master/examples/server',
  optionsSchema: {
    enable: Boolean,
    apiConfig: {
      baseURL: String,
      apiKey: String,
      organization: String,
    },
    chatConfig: {
      model: String,
      maxHistory: Number,
      systemPrompt: String,
      showReasoning: Boolean,
    },
  },
  optionsDescription: {
    enable: '启用',
    apiConfig: {
      baseURL: 'Base URL',
      apiKey: {
        readableName: 'API Key',
        description:
          "The OpenAI API uses API keys for authentication. Visit your API Keys page to retrieve the API key you'll use in your requests.",
      },
      organization: {
        readableName: '组织',
        description:
          'For users who belong to multiple organizations, you can pass a header to specify which organization is used for an API request. Usage from these API requests will count as usage for the specified organization.',
      },
    },
    chatConfig: {
      model: '模型',
      maxHistory: '最长历史大小',
      systemPrompt: 'System Prompt',
      showReasoning: '显示思考过程',
    },
  },
  defaultOptions: {
    enable: false,
    apiConfig: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      organization: '',
    },
    chatConfig: {
      model: 'gpt-4',
      maxHistory: 30,
      systemPrompt: '请将用户输入的日文翻译为中文',
      showReasoning: false,
    },
  },
  data() {
    return {
      openai: null as OpenAI | null,
      taskQueue: new TaskQueue(),
      history: [
        {
          role: 'system',
          content: '请将用户输入的日文翻译为中文',
        },
      ] as ChatCompletionMessageParam[],
    };
  },
  async init() {
    this.openai = new OpenAI(this.apiConfig);
  },
  isReady() {
    return this.enable && !!this.openai;
  },
  async *translate(t) {
    using _lock = await this.taskQueue.acquire();
    this.history.push({ role: 'user', content: t });
    const cur = { role: 'assistant' as const, content: '' };
    this.history.push(cur);
    while (this.history.length > this.chatConfig.maxHistory) {
      while (this.history[1].role !== 'user' || this.history.length > this.chatConfig.maxHistory) {
        this.history.splice(1, 1);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stream = await this.openai!.chat.completions.create({
      model: this.chatConfig.model,
      messages: this.history.slice(0, -1),
      stream: true,
    });
    for await (const chunk of stream) {
      for (const choice of chunk.choices) {
        if (choice.delta.content) {
          cur.content += choice.delta.content;
          yield choice.delta.content;
        }
        // @ts-expect-error for deepseek-r1
        if (choice.delta.reasoning_content) {
          // 思考过程不要放到下次的上下文里面
          // @ts-expect-error for deepseek-r1
          yield choice.delta.reasoning_content;
        }
      }
    }
  },
});
