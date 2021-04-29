import { InsecureRemoteBrowserWindow } from '@main/window/InsecureRemoteBrowserWindow';
import { defineTranslateProvider } from '@main/providers/translate';
import { app } from 'electron';

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
            browserWindow: null as InsecureRemoteBrowserWindow | null,
            ready: false
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        await app.whenReady();
        const browserWindow = new InsecureRemoteBrowserWindow();
        browserWindow.webContents.loadURL('https://fanyi.qq.com/');
        browserWindow.webContents.on('dom-ready', async () => {
            await browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
                [{
                    code:
                        '(async function() {' +
                        "    document.querySelector('#language-button-group-source .language-button').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    let node = Array.from(document.querySelectorAll('[node-type="source_language_list"] li')).find(i => i.innerText === ${JSON.stringify(this.fromLanguage)});` +
                        '    node?.click();' +
                        '' +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        '' +
                        "    document.querySelector('#language-button-group-target .language-button').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    node = Array.from(document.querySelectorAll('[node-type="target_language_list"] li')).find(i => i.innerText === ${JSON.stringify(this.toLanguage)});` +
                        '    node?.click();' +
                        '})();'
                }]
            );
            this.browserWindow = browserWindow;
            this.ready = true;
        });
    },
    isReady() { return this.enable && this.ready && !!this.browserWindow; },
    translate(t) {
        if (!this.browserWindow) throw new Error('browserView is not ready');
        return this.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
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
        this.browserWindow?.destroy();
        this.browserWindow = null;
    }
});
