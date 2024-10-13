import logger from '@logger/extractor/IExtractor';
import EventEmitter from 'events';

export declare interface IExtractor extends EventEmitter {
  on: ((event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void) => this) &
    (<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void) => this);

  once: ((event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void) => this) &
    (<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void) => this);

  off: ((event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void) => this) &
    (<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void) => this);
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

  public abstract pause(): void;
  public abstract resume(): void;

  public abstract destroy(): void;
}
