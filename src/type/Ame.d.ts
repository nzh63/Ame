declare namespace Ame {
    export type GameSetting = {
        uuid: string;
        name: string;
        path: string;
        execShell: string;
        type: Ame.Extractor.ExtractorType;
        hookCode: string;
        textractor?: {
            postProcessOption?: {
                removeDuplication?: boolean;
            };
        };
        ocr?: {
            rect?: import('sharp').Region;
            preprocess?: import('@main/extractor/OcrExtractor').PreprocessOption;
        };
    };
    export type IpcRet<T> = { err: any } | { value: T };

    namespace Extractor {
        export type ExtractorType = 'textractor' | 'ocr';
        export type Key = string | 'any';
        export type Result = { [key in Ame.Extractor.Key]: string };
    }

    namespace Translator {
        export type OriginalText = { key: Ame.Extractor.Key, text: string };
        export type TranslateResult = { key: Ame.Extractor.Key, originalText: string, translateText: string, providerId: string };
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
