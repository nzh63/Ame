import querystring from 'querystring';
import fetch from 'electron-fetch';
import { defineOCRProvider } from '@main/providers/ocr';

export default defineOCRProvider({
    id: '百度AI开放平台',
    optionsSchema: {
        enable: Boolean,
        apiConfig: {
            apiKey: [String, null] as const,
            secretKey: [String, null] as const
        }
    },
    defaultOptions: {
        enable: true,
        apiConfig: {
            apiKey: null,
            secretKey: null
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
        fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.options.apiConfig.apiKey}&client_secret=${this.options.apiConfig.secretKey}`, { method: 'POST' })
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
            body: querystring.stringify({
                image: img.toPNG().toString('base64'),
                language_type: 'JAP'
            })
        }).then(res => res.json());
        if (!json.words_result) throw json;
        return json.words_result.map((i: { words: string; }) => i.words).join('\n');
    },
    destroy() { }
});
