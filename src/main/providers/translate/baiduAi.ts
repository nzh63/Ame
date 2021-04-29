import { defineTranslateProvider } from '@main/providers/translate';
import { net } from 'electron';
import crypto from 'crypto';
import querystring from 'querystring';

export default defineTranslateProvider({
    id: '百度AI开放平台',
    description: '百度AI开放平台机器翻译API，详见 https://api.fanyi.baidu.com \n此翻译器会向 api.fanyi.baidu.com 发送数据',
    optionsSchema: {
        enable: Boolean,
        apiConfig: {
            appid: [String, null] as const,
            key: [String, null] as const,
            fromLanguage: String,
            toLanguage: String
        }
    },
    defaultOptions: {
        enable: true,
        apiConfig: {
            appid: null,
            key: null,
            fromLanguage: 'jp',
            toLanguage: 'zh'
        }
    },
    optionsDescription: {
        enable: '启用',
        apiConfig: {
            appid: { readableName: 'APP ID', description: '可在 https://api.fanyi.baidu.com/api/trans/product/desktop?req=developer 获取' },
            key: { readableName: 'Key', description: '可在 https://api.fanyi.baidu.com/api/trans/product/desktop?req=developer 获取' },
            fromLanguage: '源语言',
            toLanguage: '目标语言'
        }
    },
    data() {
        return null;
    }
}, {
    init() { },
    isReady() {
        return this.enable &&
            this.apiConfig.appid !== null &&
            this.apiConfig.key !== null;
    },
    async translate(text) {
        const salt = (new Date()).getTime();
        const str1 = this.apiConfig.appid + text + salt + this.apiConfig.key;
        const md5 = crypto.createHash('md5');
        const sign = md5.update(str1).digest('hex');
        return new Promise<string>((resolve, reject) => {
            const request = net.request('https://fanyi-api.baidu.com/api/trans/vip/translate?' + querystring.stringify({
                q: text,
                appid: this.apiConfig.appid,
                salt: salt,
                from: this.apiConfig.fromLanguage,
                to: this.apiConfig.toLanguage,
                sign: sign
            }));
            request.on('response', async (response) => {
                if (!response.statusCode || response.statusCode >= 400) {
                    throw new Error(`http error: ${response.statusCode} ${response.statusMessage}`);
                }
                try {
                    let body = '';
                    response.on('data', (chunk) => { body += chunk.toString(); });
                    await new Promise(resolve => response.once('end', resolve));
                    const translateResult = JSON.parse(body);
                    if (!translateResult.trans_result) reject(translateResult);
                    resolve(translateResult.trans_result.map((i: any) => i.dst).join('\n'));
                } catch (e) {
                    reject(e);
                }
            });
            request.on('error', (e) => reject(e));
            request.end();
        });
    }
});
