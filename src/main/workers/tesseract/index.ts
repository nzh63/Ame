import path from 'path';
import { workerData, parentPort } from 'worker_threads';
import { createWorker, Worker } from 'tesseract.js';
import { __assets } from '@main/paths';

(async function () {
    const worker: Worker = createWorker({
        langPath: path.join(__assets, 'lang-data'),
        cacheMethod: 'none',
        gzip: false,
        logger: m => parentPort?.postMessage({ type: 'log', value: m })
    });
    await worker.load();
    await worker.loadLanguage(workerData);
    await worker.initialize(workerData);
    parentPort?.on('message', async (args) => {
        if (args.type === 'recognize') {
            const { data } = await worker.recognize(args.img);
            parentPort?.postMessage({ type: 'reply', text: data.text, id: args.id });
        } else if (args.type === 'exit') {
            process.exit();
        }
    });
    parentPort?.postMessage({ type: 'ok' })
})()