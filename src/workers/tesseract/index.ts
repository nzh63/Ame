import { range } from 'lodash-es';
import { createRequire } from 'node:module';
import path from 'path';
import { workerData, parentPort } from 'worker_threads';

// 在 tesseract.js 被 import 之前，拦截 worker_threads.Worker 构造函数，
// 为 tesseract.js 内部创建的所有 Worker 线程注入 resourceLimits
const require = createRequire(import.meta.url);
const wt = require('worker_threads');
const OrigWorker: typeof wt.Worker = wt.Worker;
class PatchedWorker extends OrigWorker {
  public constructor(filename: string | URL, options?: any) {
    super(filename, {
      ...options,
      resourceLimits: {
        maxOldGenerationSizeMb: 1024,
        ...options?.resourceLimits,
      },
    });
  }
}
wt.Worker = PatchedWorker as typeof OrigWorker;

const { __static, lang } = workerData;

(async function () {
  // 现在 import tesseract.js，它内部 new Worker() 会被拦截
  const { createScheduler, createWorker, OEM } = await import('tesseract.js');
  const scheduler = createScheduler();
  await Promise.all(
    range(process.arch === 'ia32' ? 1 : 4).map(async () => {
      const worker = await createWorker(lang, OEM.DEFAULT, {
        langPath: path.join(__static, 'lang-data'),
        cacheMethod: 'none',
        gzip: false,
        workerPath: path.join(__dirname, 'tesseract-worker-script.js'),
        logger: import.meta.env.LOGGING ? (m) => parentPort?.postMessage({ type: 'log', value: m }) : () => {},
      });
      scheduler.addWorker(worker);
    }),
  );
  parentPort?.on('message', async (args) => {
    if (args.type === 'recognize') {
      const { data } = await scheduler.addJob('recognize', args.img);
      parentPort?.postMessage({ type: 'reply', text: data.text, id: args.id });
    } else if (args.type === 'exit') {
      scheduler.terminate();
      setTimeout(() => process.exit(), 1000);
    }
  });
  parentPort?.postMessage({ type: 'ok' });
})();
