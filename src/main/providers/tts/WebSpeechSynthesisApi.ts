import type { JSONSchema } from '@main/schema';
import { app, BrowserView } from 'electron';
import { defineTTSProvider } from '@main/providers/tts';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/providers/WebSpeechSynthesisApi';

export default defineTTSProvider({
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
            browserView: null as BrowserView | null,
            voices: null as { lang: string; name: string; voiceURI: string }[] | null
        };
    }
}, {
    async init() {
        if (!this.options.enable) return;
        await app.whenReady();
        const browserView = new BrowserView();
        browserView.webContents.loadURL('about:black');
        browserView.webContents.executeJavaScript(
            '(function() {' +
            '    return new Promise(resolve => {' +
            '        function check() {' +
            '            console.log(speechSynthesis.getVoices());' +
            '            if (speechSynthesis.getVoices().length && speechSynthesis.getVoices().every(i => i.voiceURI)) {' +
            '                resolve(JSON.stringify(speechSynthesis.getVoices().map(i => ({voiceURI: i.voiceURI, lang: i.lang, name: i.name }))));' +
            '            }' +
            '        }' +
            '        speechSynthesis.onvoiceschanged = check;' +
            '        check();' +
            '    })' +
            '})()')
            .then(arg => {
                arg = JSON.parse(arg);
                if (arg instanceof Array && arg.every(i => i.voiceURI)) {
                    this.data.voices = arg;
                }
            });
        this.data.browserView = browserView;
    },
    isReady() { return this.options.enable && !!this.data.browserView; },
    speak(text, type) {
        if (!this.data.browserView) return;
        const execCode = `
        (function() {
            speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(${JSON.stringify(text)});
    ${(() => {
        let voiceURI: string | null = null;
        if (this.options.voice.originalVoiceURI && type === 'original') {
            voiceURI = this.options.voice.originalVoiceURI;
        }
        if (this.options.voice.translateVoiceURI && type === 'translate') {
            voiceURI = this.options.voice.translateVoiceURI;
        }
        if (voiceURI) {
            return `utter.voice = speechSynthesis.getVoices().find(v => v.voiceURI === ${JSON.stringify(voiceURI)});`;
        }
        return ';';
    })()}
            speechSynthesis.speak(utter);
        })()`;
        logger('execCode: %s', execCode);
        logger('options: %O', this.options);
        this.data.browserView.webContents.executeJavaScript(execCode, true);
    },
    destroy() {
        this.data.browserView = null;
    },
    getOptionsJSONSchema() {
        const schema = toJSONSchema(this.optionsSchema, this.config.defaultOptions);
        if (this.data.voices?.length) {
            const voice = schema.properties?.voice as JSONSchema;
            if (voice?.properties?.originalVoiceURI && voice?.properties?.originalVoiceURI !== true) {
                voice.properties.originalVoiceURI.enum = [null, ...this.data.voices.map(i => i.voiceURI)];
            }
            if (voice?.properties?.translateVoiceURI && voice?.properties?.translateVoiceURI !== true) {
                voice.properties.translateVoiceURI.enum = [null, ...this.data.voices.map(i => i.voiceURI)];
            }
        }
        return schema;
    }
});
