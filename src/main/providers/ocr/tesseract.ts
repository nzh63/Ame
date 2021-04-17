import path from 'path';
import { Worker } from 'worker_threads';
import { defineOCRProvider } from '@main/providers/ocr';
import { __workers } from '@main/paths';
import logger from '@logger/provider/ocr/tesseract';

export default defineOCRProvider({
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
        if (!this.options.enable) return;
        const worker = new Worker(path.join(__workers, './tesseract.js'), {
            workerData: this.options.language
        });
        worker.once('message', arg => {
            this.data.worker = worker;
        });
        if (import.meta.env.DEV) {
            worker.on('message', args => {
                if (args.type === 'log') {
                    logger(args.value);
                }
            });
        }
    },
    isReady() { return this.options.enable && !!this.data.worker; },
    async recognize(img) {
        if (!this.data.worker) throw new Error('worker not init');
        const id = Math.floor(Math.random() * 10000);
        this.data.worker.postMessage({ type: 'recognize', id, img: await img.png().toBuffer() });
        return new Promise<string>(resolve => {
            const callback = (arg: { type: string; id: number; text: string; }) => {
                if (arg.type === 'reply') {
                    if (arg.id === id) {
                        this.data.worker?.off('message', callback);
                        resolve(arg.text);
                    }
                }
            };
            this.data.worker?.on('message', callback);
        });
    },
    destroy() {
        this.data.worker?.postMessage({ type: 'exit' });
        this.data.worker?.removeAllListeners();
    }
});
