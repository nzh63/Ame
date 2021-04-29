import { app, BrowserWindow } from 'electron';
import { defineTtsProvider } from '@main/providers/tts';
import logger from '@logger/providers/WebSpeechSynthesisApi';

export default defineTtsProvider({
    id: 'WebSpeechSynthesisApi',
    description: '使用 Web SpeechSynthesis Api，所支持的语音基于机器上已安装的语音包，请参考 https://go.microsoft.com/fwlink/?linkid=2043241 获取更多信息',
    optionsSchema: {
        enable: Boolean,
        voice: {
            originalVoiceURI: [String, null] as const,
            translateVoiceURI: [String, null] as const
        }
    },
    defaultOptions: {
        enable: true,
        voice: {
            originalVoiceURI: null,
            translateVoiceURI: null
        }
    },
    optionsDescription: {
        enable: '启用',
        voice: {
            originalVoiceURI: '源语言语音',
            translateVoiceURI: '翻译语言语音'
        }
    },
    data() {
        return {
            browserWindow: null as BrowserWindow | null
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        await app.whenReady();
        const browserWindow = new BrowserWindow({ show: false });
        browserWindow.webContents.loadURL('about:black');
        browserWindow.webContents.executeJavaScript('speechSynthesis.getVoices()');
        this.browserWindow = browserWindow;
    },
    isReady() { return this.enable && !!this.browserWindow; },
    speak(text, type) {
        if (!this.browserWindow) return;
        const execCode = `
        (function() {
            speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(${JSON.stringify(text)});
    ${(() => {
        let voiceURI: string | null = null;
        if (this.voice.originalVoiceURI && type === 'original') {
            voiceURI = this.voice.originalVoiceURI;
        }
        if (this.voice.translateVoiceURI && type === 'translate') {
            voiceURI = this.voice.translateVoiceURI;
        }
        if (voiceURI) {
            return `utter.voice = speechSynthesis.getVoices().find(v => v.voiceURI === ${JSON.stringify(voiceURI)});`;
        }
        return ';';
    })()}
            speechSynthesis.speak(utter);
        })()`;
        logger('execCode: %s', execCode);
        logger('options: %O', this);
        this.browserWindow.webContents.executeJavaScript(execCode, true);
    },
    destroy() {
        this.browserWindow?.destroy();
        this.browserWindow = null;
    }
});
