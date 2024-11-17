import { defineTranslateProvider } from '@main/providers/translate';
import { TaskQueue } from '@main/utils';
import type { SSEResponseModel } from 'tencentcloud-sdk-nodejs/tencentcloud/common/sse_response_model';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/hunyuan/v20230901/hunyuan_client';
import type {
  Message,
  ChatCompletionsResponse,
} from 'tencentcloud-sdk-nodejs/tencentcloud/services/hunyuan/v20230901/hunyuan_models';

export default defineTranslateProvider({
  id: '腾讯混元大模型',
  description:
    '腾讯混元大模型，详见 hhttps://cloud.tencent.com/product/hunyuan \n此翻译器会向 hunyuan.tencentcloudapi.com 发送数据',
  optionsSchema: {
    enable: Boolean,
    apiConfig: {
      credential: {
        secretId: [String, null],
        secretKey: [String, null],
      },
    },
    chatConfig: {
      model: [
        'hunyuan-lite',
        'hunyuan-standard',
        'hunyuan-standard-256K',
        'hunyuan-pro',
        'hunyuan-code',
        'hunyuan-role',
        'hunyuan-functioncall',
        'hunyuan-vision',
      ],
      maxHistory: Number,
      systemPrompt: String,
    },
  } as const,
  defaultOptions: {
    enable: true,
    apiConfig: {
      credential: {
        secretId: null,
        secretKey: null,
      },
    },
    chatConfig: {
      model: 'hunyuan-lite',
      maxHistory: 30,
      systemPrompt: '请将用户输入的日文翻译为中文',
    },
  },
  optionsDescription: {
    enable: '启用',
    apiConfig: {
      credential: {
        secretId: { readableName: '密钥ID', description: '可以在 https://console.cloud.tencent.com/cam/capi 获取' },
        secretKey: { readableName: '密钥KEY', description: '可以在 https://console.cloud.tencent.com/cam/capi 获取' },
      },
    },
    chatConfig: {
      model: '模型',
      maxHistory: '最长历史大小',
      systemPrompt: 'System Prompt',
    },
  },
  data() {
    return {
      client: null as null | Client,
      taskQueue: new TaskQueue(),
      history: [] as Message[],
    };
  },
  init() {
    if (!this.apiConfig.credential.secretId || !this.apiConfig.credential.secretKey) return;
    const clientConfig = {
      credential: {
        secretId: this.apiConfig.credential.secretId,
        secretKey: this.apiConfig.credential.secretKey,
      },
      profile: {
        httpProfile: {
          endpoint: 'hunyuan.tencentcloudapi.com',
        },
      },
    };
    this.client = new Client(clientConfig);
    this.history.push({
      Role: 'system',
      Content: this.chatConfig.systemPrompt,
    });
  },
  isReady() {
    return (
      this.enable &&
      this.apiConfig.credential.secretId !== null &&
      this.apiConfig.credential.secretKey !== null &&
      !!this.client
    );
  },
  async *translate(t) {
    if (!this.client) throw new Error('client have not been init');
    const lock = await this.taskQueue.acquire();
    try {
      this.history.push({ Role: 'user', Content: t });
      const cur = { Role: 'assistant', Content: '' };
      this.history.push(cur);
      while (this.history.length > this.chatConfig.maxHistory) {
        while (this.history[1].Role !== 'user' || this.history.length > this.chatConfig.maxHistory) {
          this.history.splice(1, 1);
        }
      }
      const stream = (await this.client.ChatCompletions({
        Model: this.chatConfig.model,
        Stream: true,
        StreamModeration: true,
        Messages: this.history.slice(0, -1),
      })) as SSEResponseModel;
      for await (const chunk of stream) {
        const v: ChatCompletionsResponse = JSON.parse(chunk.data);
        if (!v.Choices) continue;
        for (const choice of v.Choices) {
          if (!choice.Delta?.Content) continue;
          yield choice.Delta.Content;
        }
      }
    } finally {
      lock.release();
    }
  },
});
