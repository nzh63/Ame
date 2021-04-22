import { InsecureRemoteBrowserWindow } from '@main/window/InsecureRemoteBrowserWindow';
import { defineTranslateProvider } from '@main/providers/translate';
import { app } from 'electron';

export default defineTranslateProvider({
    id: '谷歌翻译',
    description: '谷歌翻译网页版\n此翻译器会向 translate.google.cn 发送数据',
    optionsSchema: {
        enable: Boolean,
        fromLanguage: String,
        toLanguage: String
    },
    defaultOptions: {
        enable: false,
        fromLanguage: 'ja',
        toLanguage: 'zh-CN'
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
        if (!this.options.enable) return;
        await app.whenReady();
        const browserWindow = new InsecureRemoteBrowserWindow();
        browserWindow.webContents.loadURL(`https://translate.google.cn/?sl=${this.options.fromLanguage}&tl=${this.options.toLanguage}&op=translate`);
        browserWindow.webContents.on('dom-ready', async () => {
            this.data.browserWindow = browserWindow;
            this.data.ready = true;
        });
    },
    isReady() { return this.options.enable && this.data.ready && !!this.data.browserWindow; },
    async translate(t) {
        if (!this.data.browserWindow) throw new Error('browserView is not ready');
        await this.data.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
            [{
                code:
                    `document.querySelector('textarea[aria-label="原文"]').value = ${JSON.stringify(t)};` +
                    "document.querySelector('textarea[aria-label=\"原文\"]').focus();" +
                    "console.log(document.querySelector('textarea[aria-label=\"原文\"]').value);"
            }]
        );
        await new Promise(resolve => setImmediate(resolve));
        await this.data.browserWindow.webContents.insertText(' ');
        const promise = this.data.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
            [{
                code:
                    'new Promise(resolve => {' +
                    '    var observar = new MutationObserver(function (record) {' +
                    "        if (document.querySelector('c-wiz[role =\"region\"] span[data-language-to-translate-into]')) {" +
                    '           observar.disconnect();' +
                    "           resolve(document.querySelector('c-wiz[role=\"region\"] span[data-language-to-translate-into]').innerText);" +
                    '        }' +
                    '    });' +
                    "    observar.observe(document.querySelector('c-wiz[role=\"region\"]'), {childList: true,characterData: true, subtree: true});" +
                    '})'
            }]
        );
        return promise;
    },
    destroy() {
        this.data.browserWindow?.destroy();
        this.data.browserWindow = null;
    }
});
