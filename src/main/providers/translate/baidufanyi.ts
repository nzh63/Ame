import { InsecureRemoteBrowserWindow } from '@main/window/InsecureRemoteBrowserWindow';
import { defineTranslateProvider } from '@main/providers/translate';
import { app } from 'electron';

export default defineTranslateProvider({
    id: '百度翻译',
    description: '百度翻译网页版\n此翻译器会向 fanyi.baidu.com 发送数据',
    optionsSchema: {
        enable: Boolean,
        fromLanguage: String,
        toLanguage: String
    },
    defaultOptions: {
        enable: true,
        fromLanguage: '日语',
        toLanguage: '中文(简体)'
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
        browserWindow.webContents.loadURL('https://fanyi.baidu.com/');
        browserWindow.webContents.on('dom-ready', async () => {
            await browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
                [{
                    code:
                        '(async function() {' +
                        "    document.querySelector('.select-from-language .language-selected').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    let node = Array.from(document.querySelectorAll('.lang-table .lang-item')).find(i => i.innerText === ${JSON.stringify(this.options.fromLanguage)});` +
                        '    if (node){' +
                        "        if  (node.className.split(' ').includes('selected')){" +
                        "            document.querySelector('.select-from-language .language-selected').click();" +
                        '        } else {' +
                        '            node.click();' +
                        '        }' +
                        '    }' +
                        '' +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        '' +
                        "    document.querySelector('.select-to-language .language-selected').click();" +
                        '    await new Promise(resolve => setTimeout(resolve, 0));' +
                        `    node = Array.from(document.querySelectorAll('.lang-table .lang-item')).find(i => i.innerText === ${JSON.stringify(this.options.toLanguage)});` +
                        '    if (node){' +
                        "        if  (node.className.split(' ').includes('selected')){" +
                        "            document.querySelector('.select-to-language .language-selected').click()" +
                        '        } else {' +
                        '            node.click();' +
                        '        }' +
                        '    }' +
                        '})();'
                }]
            );
            this.data.browserWindow = browserWindow;
            this.data.ready = true;
        });
    },
    isReady() { return this.options.enable && this.data.ready && !!this.data.browserWindow; },
    translate(t) {
        if (!this.data.browserWindow) throw new Error('browserView is not ready');
        return this.data.browserWindow.webContents.executeJavaScriptInIsolatedWorld(1,
            [{
                code:
                    'new Promise(resolve => {' +
                    `    document.querySelector('#baidu_translate_input').value = ${JSON.stringify(t)};` +
                    "    document.querySelector('.trans-btn').click();" +
                    '    var observar = new MutationObserver(function (record) {' +
                    '        observar.disconnect();' +
                    "        resolve(document.querySelector('.output-bd .target-output').innerText);" +
                    '    });' +
                    "    observar.observe(document.querySelector('.output-wrap'), {childList: true,characterData: true, subtree: true});" +
                    '})'
            }]
        );
    },
    destroy() {
        this.data.browserWindow?.destroy();
        this.data.browserWindow = null;
    }
});
