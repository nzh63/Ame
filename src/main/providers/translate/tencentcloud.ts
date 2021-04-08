import { defineTranslateProvider } from '@main/providers/translate';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client';

export default defineTranslateProvider({
    id: '腾讯云',
    description: '腾讯云机器翻译API，详见 https://cloud.tencent.com/product/tmt \n此翻译器会向 tmt.tencentcloudapi.com 发送数据',
    optionsSchema: {
        enable: Boolean,
        apiConfig: {
            credential: {
                secretId: [String, null] as const,
                secretKey: [String, null] as const
            },
            region: String,
            params: {
                Source: {
                    type: String,
                    enum: [
                        'auto', 'zh', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'es',
                        'it', 'de', 'tr', 'ru', 'pt', 'vi', 'id', 'th', 'ms',
                        'ar', 'hi'
                    ]
                },
                Target: {
                    type: String,
                    enum: [
                        'auto', 'zh', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'es',
                        'it', 'de', 'tr', 'ru', 'pt', 'vi', 'id', 'th', 'ms',
                        'ar', 'hi'
                    ]
                },
                ProjectId: Number
            }
        }
    },
    defaultOptions: {
        enable: true,
        apiConfig: {
            credential: {
                secretId: null,
                secretKey: null
            },
            region: 'ap-guangzhou',
            params: {
                Source: 'ja',
                Target: 'zh',
                ProjectId: 0
            }
        }
    },
    optionsDescription: {
        enable: '启用',
        apiConfig: {
            credential: {
                secretId: { readableName: '密钥ID', description: '可以在 https://console.cloud.tencent.com/cam/capi 获取' },
                secretKey: { readableName: '密钥KEY', description: '可以在 https://console.cloud.tencent.com/cam/capi 获取' }
            },
            region: '地域',
            params: {
                Source: '源语言',
                Target: '目标语言'
            }
        }
    },
    data() {
        return {
            client: null as null | Client
        };
    }
}, {
    init() {
        if (!this.options.apiConfig.credential.secretId || !this.options.apiConfig.credential.secretKey) return;
        const clientConfig = {
            credential: {
                secretId: this.options.apiConfig.credential.secretId,
                secretKey: this.options.apiConfig.credential.secretKey
            },
            region: 'ap-guangzhou',
            profile: {
                httpProfile: {
                    endpoint: 'tmt.tencentcloudapi.com'
                }
            }
        };
        this.data.client = new Client(clientConfig);
    },
    isReady() {
        return this.options.enable &&
            this.options.apiConfig.credential.secretId !== null &&
            this.options.apiConfig.credential.secretKey !== null &&
            !!this.data.client;
    },
    async translate(SourceText) {
        const params = { ...this.options.apiConfig.params, SourceText };
        if (!this.data.client) throw new Error('client have not been init');
        const res = await this.data.client.TextTranslate(params);
        if (res.TargetText !== undefined) {
            return res.TargetText;
        }
        throw res;
    }
});
