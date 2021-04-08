import { InsecureRemoteBrowserView } from '@main/InsecureRemoteBrowserView';
import { defineTranslateProvider } from '@main/providers/translate';
import { app, BrowserView } from 'electron';

export default defineTranslateProvider({
    id: '腾讯翻译君',
    description: '腾讯翻译君网页版\n此翻译器会向 fanyi.qq.com 发送数据',
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
        browserView.webContents.loadURL('https://fanyi.qq.com/');
        browserView.webContents.on('dom-ready', async () => {
            await browserView.webContents.executeJavaScriptInIsolatedWorld(1,
                [{
                    code:
                        '(async function() {' +
                        "    document.querySelector('#language-button-group-source .language-button').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    let node = Array.from(document.querySelectorAll('[node-type="source_language_list"] li')).find(i => i.innerText === ${JSON.stringify(this.options.fromLanguage)});` +
                        '    node?.click();' +
                        '' +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        '' +
                        "    document.querySelector('#language-button-group-target .language-button').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    node = Array.from(document.querySelectorAll('[node-type="target_language_list"] li')).find(i => i.innerText === ${JSON.stringify(this.options.toLanguage)});` +
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
                    `    document.querySelector('[node-type="source-textarea"]').value = ${JSON.stringify(t)};` +
                    "    document.querySelector('[node-type=\"translate_button\"]').click();" +
                    '    var observar = new MutationObserver(function (record) {' +
                    '        observar.disconnect();' +
                    "        resolve(Array.from(document.querySelectorAll('[node-type=\"textpanel-target-textblock\"] .text-dst')).map(i => i.innerText).join(''));" +
                    '    });' +
                    "    observar.observe(document.querySelector('[node-type=\"textpanel-target-textblock\"]'), {childList: true,characterData: true, subtree: true});" +
                    '})'
            }]
        );
    },
    destroy() {
        this.data.browserView = null;
    }
});
