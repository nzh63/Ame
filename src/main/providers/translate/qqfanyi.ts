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
        toLanguage: '简体中文'
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
            browserWindow.webContents.loadURL('https://fanyi.qq.com/');
            await new Promise<void>(resolve => browserWindow.on('ready-to-show', () => resolve()));
            browserWindow.webContents.reload();
            await new Promise<void>(resolve => browserWindow.webContents.on('dom-ready', () => resolve()));
            await browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
                [{
                    code:
                        '(async function() {' +
                        "    document.querySelector('.translate-content .content-left .tea-dropdown').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 1000));' +
                        `    let node = Array.from(document.querySelectorAll('#tea-overlay-root li')).find(i => i.innerText === ${JSON.stringify(this.fromLanguage)});` +
                        '    node?.click();' +
                        '' +
                        '    await new Promise(resolve => setTimeout(resolve, 1000));' +
                        '' +
                        "    document.querySelector('.translate-content .content-right .tea-dropdown').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 1000));' +
                        `    node = Array.from(document.querySelectorAll('#tea-overlay-root li')).find(i => i.innerText === ${JSON.stringify(this.toLanguage)});` +
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
                    '    const textarea = document.querySelector(".translate-content .content-left .tea-textarea");' +
                    `    textarea.value = ${JSON.stringify(t)};` +
                    '    var observar = new MutationObserver(function (record) {' +
                    '        observar.disconnect();' +
                    "        resolve(Array.from(document.querySelectorAll('.translate-content .content-right  .target-text-box')).map(i => i.innerText).join(''));" +
                    '    });' +
                    "    observar.observe(document.querySelector('.translate-content .content-right  .target-text-box'), {childList: true,characterData: true, subtree: true});" +
                    "    textarea.dispatchEvent(new Event('compositionstart', { bubbles: true }));" +
                    "    textarea.dispatchEvent(new Event('compositionend', { bubbles: true }));" +
                    '})'
            }]
        );
    },
    destroy() {
        this.browserWindow?.destroy();
        this.browserWindow = null;
    }
});
