import logger from '@logger/provider/segment/intl-segmenter';
import { __workers } from '@main/paths';
import { defineSegmentProvider } from '@main/providers/segment';
import path from 'path';
import { Worker } from 'worker_threads';

export default defineSegmentProvider({
  id: 'intl-segmenter',
  optionsSchema: {
    enable: Boolean,
    language: String,
  },
  defaultOptions: {
    enable: true,
    language: 'ja',
  },
  optionsDescription: {
    enable: '启用',
    language: '语言',
  },
  data() {
    return {
      worker: null as null | Worker,
      nextId: 0,
    };
  },
  async init() {
    if (!this.enable) return;
    const worker = new Worker(path.join(__workers, './intl-segmenter.js'), {
      workerData: { lang: this.language },
    });
    worker.on('exit', () => {
      this.worker = null;
    });
    worker.on('error', (err: Error) => {
      this.worker = null;
    });
    if (import.meta.env.LOGGING) {
      worker.on('message', (args) => {
        if (args.type === 'log') {
          logger(args.value);
        }
      });
    }
    await new Promise<void>((resolve, reject) => {
      const onMessage = (args: { type: string }) => {
        if (args.type === 'ok') {
          worker.off('message', onMessage);
          worker.off('exit', onInitExit);
          worker.off('error', onInitError);
          resolve();
        }
      };
      const onInitExit = () => {
        worker.off('message', onMessage);
        reject(new Error('intl-segmenter worker exited during initialization'));
      };
      const onInitError = (err: Error) => {
        worker.off('message', onMessage);
        reject(err);
      };
      worker.on('message', onMessage);
      worker.on('exit', onInitExit);
      worker.on('error', onInitError);
    });
    this.worker = worker;
  },
  isReady() {
    return this.enable && !!this.worker;
  },
  segment(text: string) {
    if (!this.worker) throw new Error('worker not init');
    const id = this.nextId++;
    this.worker.postMessage({ type: 'segment', id, text });
    return new Promise<string[]>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        this.worker?.off('message', onMessage);
        this.worker?.off('exit', onExit);
        this.worker?.off('error', onError);
      };
      const onMessage = (arg: { type: string; id: number; segments: string[] }) => {
        if (arg.type === 'reply' && arg.id === id) {
          cleanup();
          resolve(arg.segments);
        }
      };
      const onExit = () => {
        cleanup();
        reject(new Error('intl-segmenter worker exited unexpectedly'));
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      this.worker?.on('message', onMessage);
      this.worker?.on('exit', onExit);
      this.worker?.on('error', onError);
    });
  },
  destroy() {
    this.worker?.postMessage({ type: 'exit' });
    this.worker?.removeAllListeners();
  },
});
