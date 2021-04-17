import path from 'path';
import { workerData, parentPort } from 'worker_threads';
import { createScheduler, createWorker, Worker } from 'tesseract.js';

const { __static, lang } = workerData;

(async function() {
    const scheduler = createScheduler();
    for (let i = 0; i < 4; i++) {
        const worker: Worker = createWorker({
            langPath: path.join(__static, 'lang-data'),
            cacheMethod: 'none',
            gzip: false,
            logger: import.meta.env.DEV ? m => parentPort?.postMessage({ type: 'log', value: m }) : () => {}
        });
        await worker.load();
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
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
