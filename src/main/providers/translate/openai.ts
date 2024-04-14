import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources';
import { Readable } from 'stream';
import OpenAI from 'openai';
import { defineTranslateProvider } from '@main/providers/translate';

export default defineTranslateProvider({
    id: 'OpenAI-Compatible API',
    description: '你可能对以下链接感兴趣：\nhttps://platform.openai.com/docs/api-reference\nhttps://github.com/ggerganov/llama.cpp/blob/master/examples/server',
    optionsSchema: {
        enable: Boolean,
        apiConfig: {
            baseURL: String,
            apiKey: String,
            organization: String
        },
        chatConfig: {
            model: String,
            maxHistory: Number
        }
    },
    optionsDescription: {
        enable: '启用',
        apiConfig: {
            baseURL: 'Base URL',
            apiKey: { readableName: 'API Key', description: 'The OpenAI API uses API keys for authentication. Visit your API Keys page to retrieve the API key you\'ll use in your requests.' },
            organization: { readableName: '组织', description: 'For users who belong to multiple organizations, you can pass a header to specify which organization is used for an API request. Usage from these API requests will count as usage for the specified organization.' }
        },
        chatConfig: {
            model: '模型',
            maxHistory: '最长历史大小'
        }
    },
    defaultOptions: {
        enable: false,
        apiConfig: {
            baseURL: 'https://api.openai.com/v1',
            apiKey: '',
            organization: ''
        },
        chatConfig: {
            model: 'gpt-4',
            maxHistory: 100
        }
    },
    data() {
        return {
            openai: null as OpenAI | null,
            history: [{
                role: 'system',
                content: '请将用户输入的日文翻译为中文'
            }] as ChatCompletionMessageParam[]
        };
    }
}, {
    async init() {
        this.openai = new OpenAI(this.apiConfig);
    },
    isReady() { return this.enable && !!this.openai; },
    async translate(t) {
        this.history.push({ role: 'user', content: t });
        let cur: ChatCompletionMessageParam;
        if (this.history.length && this.history[this.history.length - 1].role === 'assistant') {
            cur = this.history[this.history.length - 1];
        } else {
            cur = { role: 'assistant', content: '' };
            this.history.push(cur);
        }
        if (this.history.length > this.chatConfig.maxHistory) {
            this.history = this.history.splice(1, this.history.length - this.chatConfig.maxHistory);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const stream = await this.openai!.chat.completions.create({
            model: this.chatConfig.model,
            messages: this.history,
            stream: true
        });
        const iter: AsyncIterator<ChatCompletionChunk> = stream[Symbol.asyncIterator]();
        const readable = new Readable({
            read: async () => {
                try {
                    const { value, done } = await iter.next();
                    if (done) {
                        readable.push(null);
                        return;
                    }
                    const content = value.choices[0]?.delta?.content ?? '';
                    readable.push(content);
                    cur.content += content;
                } catch (e) {
                    readable.destroy(e as Error);
                }
            },
            destroy: () => {
                stream.controller.abort();
            }
        });
        return readable;
    }

});
