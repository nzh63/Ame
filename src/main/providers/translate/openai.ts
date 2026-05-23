import { defineTranslateProvider } from '@main/providers/translate';
import { TaskQueue } from '@main/utils';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/index';

export default defineTranslateProvider({
  id: 'OpenAI-Compatible API',
  description:
    '你可能对以下链接感兴趣：\nhttps://platform.openai.com/docs/api-reference\nhttps://openrouter.ai/docs/quickstart',
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
      reasoningEffort: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const,
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
      reasoningEffort: '思考强度',
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
      reasoningEffort: 'none' as const,
    },
  },
  data() {
    return {
      openai: null as OpenAI | null,
      taskQueue: new TaskQueue(),
      history: [] as ChatCompletionMessageParam[],
    };
  },
  async init() {
    this.openai = new OpenAI(this.apiConfig);
    this.history.push({
      role: 'system',
      content: this.chatConfig.systemPrompt,
    });
  },
  isReady() {
    return this.enable && !!this.openai;
  },
  async *translate(t) {
    using _lock = await this.taskQueue.acquire();
    this.history.push({ role: 'user', content: t });
    const cur = { role: 'assistant' as const, content: '' };
    this.history.push(cur);
    // 确保始终以 system prompt 开头
    if (this.history[0].role !== 'system') {
      this.history.unshift({
        role: 'system',
        content: this.chatConfig.systemPrompt,
      });
    }
    // 裁剪到 maxHistory/2
    if (this.history.length > this.chatConfig.maxHistory) {
      const target = Math.floor(this.chatConfig.maxHistory / 2);
      while (this.history.length > target && this.history.length > 1) {
        // 跳过 system prompt，从索引 1 开始移除；user+assistant 成对移除
        this.history.splice(1, 1);
        // 成对移除紧随其后的 assistant 消息
        while (this.history.length > 1 && (this.history[1].role as string) !== 'user') {
          this.history.splice(1, 1);
        }
      }
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stream = await this.openai!.chat.completions.create({
        model: this.chatConfig.model,
        messages: this.history.slice(0, -1),
        stream: true,
        reasoning_effort: this.chatConfig.reasoningEffort,
      });
      for await (const chunk of stream) {
        for (const choice of chunk.choices) {
          if (choice.delta.content) {
            cur.content += choice.delta.content;
            yield choice.delta.content;
          }
        }
      }
    } catch (e) {
      // 流中断时移除因本次调用而追加的 user 和 assistant 消息
      if (this.history.length >= 2 && this.history[this.history.length - 1] === cur) {
        this.history.pop();
        this.history.pop();
      }
      throw e;
    }
  },
});
