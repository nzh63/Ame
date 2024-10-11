import { InsecureRemoteBrowserWindow } from '@main/window/InsecureRemoteBrowserWindow';
import { defineTranslateProvider } from '@main/providers/translate';
import { app } from 'electron';

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
            browserWindow: null as InsecureRemoteBrowserWindow | null,
            ready: false
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        await app.whenReady();
        const browserWindow = new InsecureRemoteBrowserWindow();
        try {
            browserWindow.webContents.loadURL('https://fanyi.youdao.com/');
            await new Promise<void>(resolve => browserWindow.webContents.on('dom-ready', () => resolve()));
            await browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
                [{
                    code:
                        '(async function() {' +
                        "    document.querySelector('.select-text').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    let node = Array.from(document.querySelectorAll('#languageSelect li a')).find(i => new RegExp(${JSON.stringify(this.fromLanguage)} + '.*' + ${JSON.stringify(this.toLanguage)}).test(i.innerText));` +
                        '    node?.click();' +
                        '})();'
                }]
            );
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
    translate(t) {
        if (!this.browserWindow) throw new Error('browserView is not ready');
        return this.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
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
        this.browserWindow?.destroy();
        this.browserWindow = null;
    }
});
