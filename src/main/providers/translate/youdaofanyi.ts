import { InsecureRemoteBrowserView } from '@main/InsecureRemoteBrowserView';
import { defineTranslateProvider } from '@main/providers/translate';
import { app, BrowserView } from 'electron';

export default defineTranslateProvider({
    id: '有道翻译',
    description: '有道翻译网页版\n此翻译器会向 fanyi.youdao.com 发送数据',
    optionsSchema: {
        enable: Boolean,
        fromLanguage: String,
        toLanguage: String
    },
    defaultOptions: {
        enable: true,
        fromLanguage: '日语',
        toLanguage: '中文'
    },
    optionsDescription: {
        enable: '启用',
        fromLanguage: '源语言',
        toLanguage: '目标语言'
    },
    data() {
        return {
            browserView: null as BrowserView | null,
            ready: false
        };
    }
}, {
    async init() {
        if (!this.options.enable) return;
        await app.whenReady();
        const browserView = new InsecureRemoteBrowserView();
        browserView.webContents.loadURL('https://fanyi.youdao.com/');
        browserView.webContents.on('dom-ready', async () => {
            await browserView.webContents.executeJavaScriptInIsolatedWorld(1,
                [{
                    code:
                        '(async function() {' +
                        "    document.querySelector('.select-text').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    let node = Array.from(document.querySelectorAll('#languageSelect li a')).find(i => /${this.options.fromLanguage}.*${this.options.toLanguage}/.test(i.innerText));` +
                        '    node?.click();' +
                        '})();'
                }]
            );
            this.data.browserView = browserView;
            this.data.ready = true;
        });
    },
    isReady() { return this.options.enable && this.data.ready && !!this.data.browserView; },
    translate(t) {
        if (!this.data.browserView) throw new Error('browserView is not ready');
        return this.data.browserView.webContents.executeJavaScriptInIsolatedWorld(1,
            [{
                code:
                    'new Promise(resolve => {' +
                    `    document.querySelector('#inputOriginal').value = ${JSON.stringify(t)};` +
                    "    document.querySelector('#transMachine').click();" +
                    '    var observar = new MutationObserver(function (record) {' +
                    '        observar.disconnect();' +
                    "        resolve(document.querySelector('#transTarget').innerText);" +
                    '    });' +
                    "    observar.observe(document.querySelector('#transTarget'), {childList: true,characterData: true, subtree: true});" +
                    '})'
            }]
        );
    },
    destroy() {
        this.data.browserView = null;
    }
});
