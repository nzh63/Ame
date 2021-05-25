import path from 'path';
import { Worker } from 'worker_threads';
import { __workers } from '@main/paths';
import { defineSegmentProvider } from '@main/providers/segment';
import logger from '@logger/provider/segment/intl-segmenter';

export default defineSegmentProvider({
    id: 'intl-segmenter',
    optionsSchema: {
        enable: Boolean,
        language: String
    },
    defaultOptions: {
        enable: true,
        language: 'ja'
    },
    optionsDescription: {
        enable: '启用',
        language: '语言'
    },
    data() {
        return {
            worker: null as null | Worker
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        const worker = new Worker(path.join(__workers, './intl-segmenter.js'), {
            workerData: { lang: this.language }
        });
        if (import.meta.env.DEV) {
            worker.on('message', args => {
                if (args.type === 'log') {
                    logger(args.value);
                }
            });
        }
        await new Promise(resolve => worker.once('message', resolve));
        this.worker = worker;
    },
    isReady() { return this.enable && !!this.worker; },
    segment(text: string) {
        if (!this.worker) throw new Error('worker not init');
        const id = Math.floor(Math.random() * 10000);
        this.worker.postMessage({ type: 'segment', id, text });
        return new Promise<string[]>(resolve => {
            const callback = (arg: { type: string; id: number; segments: string[]; }) => {
                if (arg.type === 'reply') {
                    if (arg.id === id) {
                        this.worker?.off('message', callback);
                        resolve(arg.segments);
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
