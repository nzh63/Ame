import logger from '@logger/provider/ocr/tesseract';
import { __workers, __static } from '@main/paths';
import { defineOcrProvider } from '@main/providers/ocr';
import path from 'path';
import { Worker } from 'worker_threads';

export default defineOcrProvider({
  id: 'tesseract',
  optionsSchema: {
    enable: Boolean,
    language: ['jpn'],
  } as const,
  defaultOptions: {
    enable: false,
    language: 'jpn',
  },
  optionsDescription: {
    enable: '启用',
    language: '识别语言类型',
  },
  data() {
    return {
      worker: null as null | Worker,
      nextId: 0,
    };
  },
  async init() {
    if (!this.enable) return;
    const worker = new Worker(path.join(__workers, './tesseract.js'), {
      workerData: { lang: this.language, __static },
    });
    worker.on('exit', () => {
      this.worker = null;
    });
    worker.on('error', () => {
      this.worker = null;
    });
    if (import.meta.env.LOGGING) {
      worker.on('message', (args) => {
        if (args.type === 'log') {
          logger('%O', args.value);
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
        reject(new Error('tesseract worker exited during initialization'));
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
  async recognize(img) {
    if (!this.worker) throw new Error('worker not init');
    const grey = (await img.clone().resize(1, 1).greyscale().raw().toBuffer()).readUInt8();
    let image = img;
    if (grey < 128) {
      image = img.clone().removeAlpha().negate();
    }
    const id = this.nextId++;
    this.worker.postMessage({ type: 'recognize', id, img: await image.png().toBuffer() });
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        this.worker?.off('message', onMessage);
        this.worker?.off('exit', onExit);
        this.worker?.off('error', onError);
      };
      const onMessage = (arg: { type: string; id: number; text: string }) => {
        if (arg.type === 'reply' && arg.id === id) {
          cleanup();
          resolve(arg.text);
        }
      };
      const onExit = () => {
        cleanup();
        reject(new Error('tesseract worker exited unexpectedly'));
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
