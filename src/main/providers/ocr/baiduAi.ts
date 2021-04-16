import querystring from 'querystring';
import fetch from 'electron-fetch';
import { defineOCRProvider } from '@main/providers/ocr';

export default defineOCRProvider({
    id: '百度AI开放平台',
    optionsSchema: {
        enable: Boolean,
        apiConfig: {
            apiKey: [String, null] as const,
            secretKey: [String, null] as const,
            language: {
                type: String,
                enum: ['CHN_ENG', 'ENG', 'JAP', 'KOR', 'FRE', 'SPA', 'POR', 'GER', 'ITA', 'RUS']
            }
        }
    },
    defaultOptions: {
        enable: true,
        apiConfig: {
            apiKey: null,
            secretKey: null,
            language: 'JAP'
        }
    },
    optionsDescription: {
        enable: '启用',
        apiConfig: {
            apiKey: { readableName: 'APP ID', description: '可在 https://console.bce.baidu.com/ai/#/ai/ocr/app/list 获取' },
            secretKey: { readableName: 'Secret Key', description: '可在 https://console.bce.baidu.com/ai/#/ai/ocr/app/list 获取' },
            language: '识别语言类型'
        }
    },
    data() {
        return {
            accessToken: ''
        };
    }
}, {
    async init() {
        if (!this.options.apiConfig.apiKey || !this.options.apiConfig.secretKey) return;
        fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.options.apiConfig.apiKey}&client_secret=${this.options.apiConfig.secretKey}`, { method: 'POST', timeout: 3000 })
            .then(res => res.json())
            .then(json => {
                this.data.accessToken = '' + json.access_token;
            });
    },
    isReady() { return this.options.enable && !!this.options.apiConfig.apiKey && !!this.options.apiConfig.secretKey && !!this.data.accessToken; },
    async recognize(img) {
        if (!this.data.accessToken) throw new Error('no access token');
        const json = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${this.data.accessToken}`, {
            method: 'POST',
            timeout: 3000,
            body: querystring.stringify({
                image: (await img.png().toBuffer()).toString('base64'),
                language_type: this.options.apiConfig.language
            })
        })
            .then(res => res.json())
            .catch(e => e);
        if (!json.words_result) throw json;
        return json.words_result.map((i: { words: string; }) => i.words).join('\n');
    },
    destroy() { }
});
