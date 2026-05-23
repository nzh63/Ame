import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { defineTranslateProvider } from '@main/providers/translate';
import { TaskQueue } from '@main/utils';

export default defineTranslateProvider({
  id: 'Anthropic Message API',
  description: '你可能对以下链接感兴趣：\nhttps://docs.anthropic.com/en/api/messages',
  optionsSchema: {
    enable: Boolean,
    apiConfig: {
      baseURL: String,
      apiKey: String,
      authToken: String,
    },
    chatConfig: {
      model: String,
      maxHistory: Number,
      maxTokens: Number,
      systemPrompt: String,
      thinkingType: ['disabled', 'enabled', 'adaptive'] as const,
      thinkingBudgetTokens: Number,
      outputEffort: ['low', 'medium', 'high', 'xhigh', 'max'] as const,
      cacheControl: Boolean,
    },
  },
  optionsDescription: {
    enable: '启用',
    apiConfig: {
      baseURL: 'Base URL',
      apiKey: {
        readableName: 'API Key',
        description:
          'Your Anthropic API key. Sent as X-Api-Key header. You can find it at https://console.anthropic.com/',
      },
      authToken: {
        readableName: 'Auth Token',
        description: 'An alternative to API Key. Sent as Bearer token in the Authorization header.',
      },
    },
    chatConfig: {
      model: '模型',
      maxHistory: '最长历史大小',
      maxTokens: '最大 Token 数',
      systemPrompt: 'System Prompt',
      thinkingType: {
        readableName: '思考模式',
        description: '扩展思考模式：disabled（禁用）、enabled（固定预算）、adaptive（自适应）',
      },
      thinkingBudgetTokens: {
        readableName: '思考预算 Token',
        description: '扩展思考的 Token 预算（仅 enabled 模式下有效，最小 1024）',
      },
      outputEffort: {
        readableName: '输出强度',
        description: '输出努力程度：low、medium、high、xhigh、max（设为空字符串则不指定）',
      },
      cacheControl: {
        readableName: '缓存控制',
        description: '在 System Prompt 上启用 Ephemeral 缓存控制',
      },
    },
  },
  defaultOptions: {
    enable: false,
    apiConfig: {
      baseURL: 'https://api.anthropic.com',
      apiKey: '',
      authToken: '',
    },
    chatConfig: {
      model: 'claude-opus-4-7',
      maxHistory: 30,
      maxTokens: 4096,
      systemPrompt: '请将用户输入的日文翻译为中文',
      thinkingType: 'disabled',
      thinkingBudgetTokens: 1024,
      outputEffort: 'low',
      cacheControl: false,
    },
  },
  data() {
    return {
      anthropic: null as Anthropic | null,
      taskQueue: new TaskQueue(),
      history: [] as MessageParam[],
    };
  },
  async init() {
    this.anthropic = new Anthropic(this.apiConfig);
  },
  isReady() {
    return this.enable && !!this.anthropic;
  },
  async *translate(t: string) {
    using _lock = await this.taskQueue.acquire();
    this.history.push({ role: 'user', content: t });
    const cur: MessageParam = { role: 'assistant', content: '' };
    this.history.push(cur);
    // 裁剪到 maxHistory/2，从最旧的开始成对移除 user+assistant
    if (this.history.length > this.chatConfig.maxHistory) {
      const target = Math.floor(this.chatConfig.maxHistory / 2);
      while (this.history.length > target && this.history.length >= 2) {
        this.history.splice(0, 2);
      }
    }
    try {
      const system = this.chatConfig.cacheControl
        ? [{ type: 'text' as const, text: this.chatConfig.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
        : this.chatConfig.systemPrompt;
      const thinking =
        !this.chatConfig.thinkingType || this.chatConfig.thinkingType === 'disabled'
          ? { type: 'disabled' as const }
          : this.chatConfig.thinkingType === 'enabled'
            ? { type: 'enabled' as const, budget_tokens: this.chatConfig.thinkingBudgetTokens || 1024 }
            : { type: 'adaptive' as const };
      const output_config = { effort: this.chatConfig.outputEffort };
      const stream = this.anthropic!.messages.stream({
        model: this.chatConfig.model,
        max_tokens: this.chatConfig.maxTokens,
        messages: this.history.slice(0, -1),
        system,
        thinking,
        output_config,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            (cur.content as string) += event.delta.text;
            yield event.delta.text;
          } else if (event.delta.type === 'thinking_delta') {
            yield event.delta.thinking;
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
