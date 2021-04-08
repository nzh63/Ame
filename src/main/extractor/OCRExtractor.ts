import type { Extractor } from '@main/extractor';
import EventEmitter from 'events';

export class OCRExtractor extends EventEmitter implements Extractor {
    constructor() {
        super();
        throw new Error('Not implemented.');
    }

    public get text(): Readonly<Ame.Extractor.Result> {
        throw new Error('Not implemented.');
    }

    public destroy() {
        throw new Error('Not implemented.');
    }
}
