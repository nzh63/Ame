import { workerData, parentPort } from 'worker_threads';

const { lang } = workerData;

const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
parentPort?.on('message', async (args) => {
    if (args.type === 'segment') {
        const segments = segmenter.segment(args.text);
        const ret = [];
        for (const { segment } of segments) {
            ret.push(segment);
        }
        parentPort?.postMessage({ type: 'reply', id: args.id, segments: ret });
    } else if (args.type === 'exit') {
        process.exit();
    }
});
parentPort?.postMessage({ type: 'ok' });
