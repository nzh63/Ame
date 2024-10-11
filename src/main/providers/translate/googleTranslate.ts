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
            browserWindow: null as InsecureRemoteBrowserWindow | null
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        await app.whenReady();
        const browserWindow = new InsecureRemoteBrowserWindow();
        try {
            browserWindow.webContents.loadURL(`https://translate.google.cn/?sl=${this.fromLanguage}&tl=${this.toLanguage}&op=translate`);
            await new Promise<void>(resolve => browserWindow.on('ready-to-show', () => resolve()));
            browserWindow.webContents.reload();
            await new Promise<void>(resolve => browserWindow.webContents.on('dom-ready', () => resolve()));
            if (!this.isDestroyed()) {
                this.browserWindow = browserWindow;
            } else {
                browserWindow.destroy();
            }
        } catch (e) {
            browserWindow.destroy();
            throw e;
        }
    },
    isReady() { return this.enable && !!this.browserWindow; },
    async translate(t) {
        if (!this.browserWindow) throw new Error('browserView is not ready');
        await this.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
            [{
                code:
                    `document.querySelector('textarea[aria-label="原文"]').value = ${JSON.stringify(t)};` +
                    "document.querySelector('textarea[aria-label=\"原文\"]').focus();" +
                    "console.log(document.querySelector('textarea[aria-label=\"原文\"]').value);"
            }]
        );
        await new Promise(resolve => setImmediate(resolve));
        await this.browserWindow.webContents.insertText(' ');
        const promise = this.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
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
        this.browserWindow?.destroy();
        this.browserWindow = null;
    }
});
