/* eslint-disable @typescript-eslint/consistent-type-imports */
declare namespace Ame {
  export interface GameSetting {
    uuid: string;
    name: string;
    path: string;
    execShell: string;
    type: Ame.Extractor.ExtractorType;
    hookCode: string;
    selectKeys?: string[];
    textractor?: {
      postProcessOption?: {
        removeDuplication?: boolean;
      };
    };
    ocr?: {
      rect?: { left: number; top: number; width: number; height: number };
      preprocess?: import('@main/extractor').PreprocessOption;
    };
  }
  export type Awaitable<T> = T | PromiseLike<T>;

  namespace Extractor {
    export type ExtractorType = 'textractor' | 'ocr';
    export type Key = string | 'any';
    export type Result = { [key in Ame.Extractor.Key]: string };
  }

  namespace Translator {
    export interface OriginalText {
      key: Ame.Extractor.Key;
      text: string;
    }
    export interface TranslateResult {
      key: Ame.Extractor.Key;
      originalText: string;
      translateText: string;
      providerId: string;
    }
    /** Error payload from `translate-watch-list-update-error` (string or Error-like). */
    export type TranslateError = string | { message?: string };
    /** A single text line paired with its per-provider translations. */
    export interface TextLine {
      id: number;
      key: Ame.Extractor.Key;
      original: string;
      translate: { id: string; text: string; err?: Ame.Translator.TranslateError }[];
    }
  }

  namespace Provider {
    export type type = 'translate' | 'tts' | 'ocr' | 'segment' | 'dict';
    export interface meta {
      id: string;
      description: string;
      jsonSchema: import('@main/schema').JSONSchema;
      optionsDescription: any;
    }
  }
}
