import path from 'path';
import { workerData, parentPort } from 'worker_threads';
import { createScheduler, createWorker, Worker } from 'tesseract.js';
import { __static } from '@main/paths';

(async function () {
    const scheduler = createScheduler();
    for (let i = 0; i < 4; i++) {
        const worker: Worker = createWorker({
            langPath: path.join(__static, 'lang-data'),
            cacheMethod: 'none',
            gzip: false,
            logger: m => parentPort?.postMessage({ type: 'log', value: m })
        });
        await worker.load();
        await worker.loadLanguage(workerData);
        await worker.initialize(workerData);
        scheduler.addWorker(worker);
    }
    parentPort?.on('message', async (args) => {
        if (args.type === 'recognize') {
            const { data } = await scheduler.addJob('recognize', args.img);
            parentPort?.postMessage({ type: 'reply', text: data.text, id: args.id });
        } else if (args.type === 'exit') {
            process.exit();
        }
    });
    parentPort?.postMessage({ type: 'ok' });
})();
