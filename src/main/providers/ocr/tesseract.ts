import path from 'path';
import { Worker } from 'worker_threads';
import { defineOcrProvider } from '@main/providers/ocr';
import { __workers, __static } from '@main/paths';
import logger from '@logger/provider/ocr/tesseract';

export default defineOcrProvider({
    id: 'tesseract',
    optionsSchema: {
        enable: Boolean,
        language: {
            type: String,
            enum: ['jpn']
        }
    },
    defaultOptions: {
        enable: false,
        language: 'jpn'
    },
    optionsDescription: {
        enable: '启用',
        language: '识别语言类型'
    },
    data() {
        return {
            worker: null as null | Worker
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        const worker = new Worker(path.join(__workers, './tesseract.js'), {
            workerData: { lang: this.language, __static }
        });
        worker.once('message', arg => {
            this.worker = worker;
        });
        if (import.meta.env.DEV) {
            worker.on('message', args => {
                if (args.type === 'log') {
                    logger(args.value);
                }
            });
        }
    },
    isReady() { return this.enable && !!this.worker; },
    async recognize(img) {
        if (!this.worker) throw new Error('worker not init');
        const grey = (await img.clone().resize(1, 1).greyscale().raw().toBuffer()).readUInt8();
        let image = img;
        console.log(grey);
        if (grey < 128) {
            image = img.clone().removeAlpha().negate();
        }
        const id = Math.floor(Math.random() * 10000);
        this.worker.postMessage({ type: 'recognize', id, img: await image.png().toBuffer() });
        return new Promise<string>(resolve => {
            const callback = (arg: { type: string; id: number; text: string; }) => {
                if (arg.type === 'reply') {
                    if (arg.id === id) {
                        this.worker?.off('message', callback);
                        resolve(arg.text);
                    }
                }
            };
            this.worker?.on('message', callback);
        });
    },
    destroy() {
        this.worker?.postMessage({ type: 'exit' });
        this.worker?.removeAllListeners();
    }
});
