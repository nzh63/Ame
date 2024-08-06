import EventEmitter from 'events';
import logger from '@logger/extractor/IExtractor';

export declare interface IExtractor extends EventEmitter {
    on(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    on<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;

    once(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    once<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;

    off(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    off<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
}

export abstract class IExtractor extends EventEmitter {
    #text: Ame.Extractor.Result = {};

    public get text(): Readonly<Ame.Extractor.Result> {
        return this.#text;
    }

    protected update(key: string, text: string) {
        logger('Extractor update { %s: %s }', key, text);
        if (text !== this.#text[key] && text.trim().length) {
            this.#text[key] = text;
            this.emit(`update:${key}`, { key, text });
            this.emit('update:any', { key, text });
        }
    }

    abstract pause(): void;
    abstract resume(): void;

    abstract destroy(): void;
}
