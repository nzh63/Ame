import path from 'path';
import { workerData, parentPort } from 'worker_threads';
import sharp from 'sharp';
import { createScheduler, createWorker, Worker } from 'tesseract.js';

const { __static, lang } = workerData;

(async function() {
    const scheduler = createScheduler();
    for (let i = 0; i < 4; i++) {
        const worker: Worker = createWorker({
            langPath: path.join(__static, 'lang-data'),
            cacheMethod: 'none',
            gzip: false,
            workerPath: path.join(__dirname, 'tesseract-worker-script.js'),
            logger: import.meta.env.DEV ? m => parentPort?.postMessage({ type: 'log', value: m }) : () => { }
        });
        await worker.load();
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        scheduler.addWorker(worker);
    }
    parentPort?.on('message', async (args) => {
        if (args.type === 'recognize') {
            const grey = (await sharp(args.img).resize(1, 1).greyscale().raw().toBuffer()).readUInt8();
            let img = args.img;
            console.log(grey);
            if (grey < 128) {
                img = await sharp(args.img).removeAlpha().negate().png().toBuffer();
            }
            const { data } = await scheduler.addJob('recognize', img);
            parentPort?.postMessage({ type: 'reply', text: data.text, id: args.id });
        } else if (args.type === 'exit') {
            scheduler.terminate();
            setTimeout(() => process.exit(), 1000);
        }
    });
    parentPort?.postMessage({ type: 'ok' });
})();
