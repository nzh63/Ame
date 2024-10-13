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
      rect?: import('sharp').Region;
      preprocess?: import('@main/extractor/OcrExtractor').PreprocessOption;
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
