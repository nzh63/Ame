import { range } from 'lodash-es';
import path from 'path';
import { createScheduler, createWorker, OEM } from 'tesseract.js';
import { workerData, parentPort } from 'worker_threads';

const { __static, lang } = workerData;

(async function () {
  const scheduler = createScheduler();
  await Promise.all(
    range(4).map(async () => {
      const worker = await createWorker(lang, OEM.DEFAULT, {
        langPath: path.join(__static, 'lang-data'),
        cacheMethod: 'none',
        gzip: false,
        workerPath: path.join(__dirname, 'tesseract-worker-script.js'),
        logger: import.meta.env.DEV ? (m) => parentPort?.postMessage({ type: 'log', value: m }) : () => {},
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
