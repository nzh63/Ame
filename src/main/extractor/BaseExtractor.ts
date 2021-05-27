import EventEmitter from 'events';
import logger from '@logger/extractor/baseExtractor';

export declare interface BaseExtractor extends EventEmitter {
    on(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    on<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;

    once(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    once<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;

    off(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    off<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
}

export abstract class BaseExtractor extends EventEmitter {
    private text_: Ame.Extractor.Result = {};

    public get text(): Readonly<Ame.Extractor.Result> {
        return this.text_;
    }

    protected onUpdate(key: string, text: string) {
        logger('Extractor update { %s: %s }', key, text);
        if (text !== this.text_[key]) {
            this.text_[key] = text;
            this.emit(`update:${key}`, { key, text });
            this.emit('update:any', { key, text });
        }
    }

    abstract pause(): void;
    abstract resume(): void;

    abstract destroy(): void;
}
