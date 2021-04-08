export * from './Textractor';
export * from './OCRExtractor';

export declare interface Extractor extends NodeJS.EventEmitter {
    on(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    on<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    once(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    once<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;

    off(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    off<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;

    text: Readonly<Ame.Extractor.Result>;
    destroy(): void;
}
